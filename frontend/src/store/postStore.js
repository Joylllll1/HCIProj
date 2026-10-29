import { create } from 'zustand';
import * as postService from '../services/postService';
import { matchPostQuery } from '../utils/search';
import useBookmarkStore from './bookmarkStore';

const FEED_PAGE_SIZE = 20;
let latestFeedRequestId = 0;
let latestMyPostsRequestId = 0;
let accountGeneration = 0;
const pendingPostLikeToggles = new Map();

function normalizeFeedSort(sort) {
  return sort === 'hot' ? 'hot' : 'latest';
}

function normalizeCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function normalizeFeedQuery(query) {
  return typeof query === 'string' ? query.trim() : '';
}

function appendUniquePosts(existingPosts = [], nextPosts = []) {
  const seenIds = new Set(existingPosts.map((post) => post.id));
  const appendedPosts = nextPosts.filter((post) => !seenIds.has(post.id));
  return [...existingPosts, ...appendedPosts];
}

function mergeLikedPostIds(currentLikedPosts = [], posts = []) {
  const loadedPostIds = new Set(posts.map((post) => post.id));
  const nextLikedPosts = posts.filter((post) => post.isLiked).map((post) => post.id);

  return [
    ...currentLikedPosts.filter((postId) => !loadedPostIds.has(postId)),
    ...nextLikedPosts,
  ];
}

function buildPostStatsMap(posts = []) {
  return posts.reduce((acc, post) => {
    if (!post?.id) return acc;
    acc[post.id] = {
      likes: normalizeCount(post.likes) ?? 0,
      saves: normalizeCount(post.saves) ?? 0,
      comments: normalizeCount(post.comments) ?? 0,
    };
    return acc;
  }, {});
}

function mergePostStatsMap(currentMap, posts = []) {
  return {
    ...currentMap,
    ...buildPostStatsMap(posts),
  };
}

function mergePostStatsEntry(currentMap, postId, stats = {}) {
  if (!postId) return currentMap;

  const nextStats = {};
  const likes = normalizeCount(stats.likes);
  const saves = normalizeCount(stats.saves);
  const comments = normalizeCount(stats.comments);

  if (likes !== undefined) nextStats.likes = likes;
  if (saves !== undefined) nextStats.saves = saves;
  if (comments !== undefined) nextStats.comments = comments;
  if (Object.keys(nextStats).length === 0) return currentMap;

  return {
    ...currentMap,
    [postId]: {
      ...(currentMap[postId] || {}),
      ...nextStats,
    },
  };
}

function applyStatsToPost(post, stats = {}) {
  if (!post) return post;

  const nextLikes = normalizeCount(stats.likes);
  const nextSaves = normalizeCount(stats.saves);
  const nextComments = normalizeCount(stats.comments);

  if (nextLikes === undefined && nextSaves === undefined && nextComments === undefined) {
    return post;
  }

  return {
    ...post,
    ...(nextLikes !== undefined ? { likes: nextLikes } : {}),
    ...(nextSaves !== undefined ? { saves: nextSaves } : {}),
    ...(nextComments !== undefined ? { comments: nextComments } : {}),
  };
}

function applyPostStatsUpdate(state, postId, stats = {}) {
  return {
    postStatsById: mergePostStatsEntry(state.postStatsById, postId, stats),
    posts: state.posts.map((post) => (post.id === postId ? applyStatsToPost(post, stats) : post)),
    myPosts: state.myPosts.map((post) => (post.id === postId ? applyStatsToPost(post, stats) : post)),
    selectedPost:
      state.selectedPost?.id === postId
        ? applyStatsToPost(state.selectedPost, stats)
        : state.selectedPost,
  };
}

function getKnownPostLikeState(state, postId) {
  if (state.likedPosts.includes(postId)) {
    return true;
  }

  const matchedPost = state.posts.find((post) => post.id === postId);
  if (matchedPost && typeof matchedPost.isLiked === 'boolean') {
    return matchedPost.isLiked;
  }

  if (state.selectedPost?.id === postId && typeof state.selectedPost.isLiked === 'boolean') {
    return state.selectedPost.isLiked;
  }

  return undefined;
}

function applyPostLikeState(state, postId, { liked, likes }) {
  const nextState = applyPostStatsUpdate(state, postId, { likes });

  return {
    ...nextState,
    likedPosts: liked
      ? [...new Set([...state.likedPosts, postId])]
      : state.likedPosts.filter((id) => id !== postId),
    selectedPost:
      nextState.selectedPost?.id === postId
        ? { ...nextState.selectedPost, isLiked: liked }
        : nextState.selectedPost,
    posts: nextState.posts.map((post) =>
      post.id === postId ? { ...post, isLiked: liked } : post
    ),
    myPosts: nextState.myPosts.map((post) =>
      post.id === postId ? { ...post, isLiked: liked } : post
    ),
  };
}

function applyPostSaveState(state, postId, { saved, saves }) {
  const nextState = applyPostStatsUpdate(state, postId, { saves });

  return {
    ...nextState,
    posts: nextState.posts.map((post) =>
      post.id === postId ? { ...post, isSaved: saved } : post
    ),
    myPosts: nextState.myPosts.map((post) =>
      post.id === postId ? { ...post, isSaved: saved } : post
    ),
    selectedPost:
      nextState.selectedPost?.id === postId
        ? { ...nextState.selectedPost, isSaved: saved }
        : nextState.selectedPost,
  };
}

function normalizePost(post) {
  return { ...post, id: post.id || post._id?.toString() };
}

function capturePostLikeCounts(state, postId) {
  return {
    posts: state.posts
      .filter((post) => post.id === postId)
      .map((post) => normalizeCount(post.likes) ?? 0),
    myPosts: state.myPosts
      .filter((post) => post.id === postId)
      .map((post) => normalizeCount(post.likes) ?? 0),
    selectedPost: state.selectedPost?.id === postId
      ? normalizeCount(state.selectedPost.likes) ?? 0
      : undefined,
    stats: normalizeCount(state.postStatsById[postId]?.likes),
  };
}

function captureLikeCountsAfterServerResult(state, postId, likes) {
  if (likes === undefined) return null;
  return {
    posts: state.posts.filter((post) => post.id === postId).map(() => likes),
    myPosts: state.myPosts.filter((post) => post.id === postId).map(() => likes),
    selectedPost: state.selectedPost?.id === postId ? likes : undefined,
    stats: likes,
  };
}

function mergeNewerLikeCounts(job, state, postId) {
  const current = capturePostLikeCounts(state, postId);
  const previous = job.expectedLikeCounts;
  const confirmed = job.confirmedLikeCounts;
  const mergeCounts = (currentCounts, expectedCounts, confirmedCounts) => currentCounts.map(
    (count, index) => (
      expectedCounts[index] !== undefined && count === expectedCounts[index]
        ? confirmedCounts[index] ?? count
        : count
    ),
  );

  job.confirmedLikeCounts = {
    posts: mergeCounts(current.posts, previous.posts, confirmed.posts),
    myPosts: mergeCounts(current.myPosts, previous.myPosts, confirmed.myPosts),
    selectedPost: current.selectedPost === undefined
      ? undefined
      : (previous.selectedPost !== undefined && current.selectedPost === previous.selectedPost
        ? confirmed.selectedPost ?? current.selectedPost
        : current.selectedPost),
    stats: current.stats === undefined
      ? confirmed.stats
      : (previous.stats !== undefined && current.stats === previous.stats
        ? confirmed.stats ?? current.stats
        : current.stats),
  };
}

function rollbackOptimisticPostLike(state, postId, {
  wasLiked,
  optimisticLiked,
  previousLikeCounts,
  optimisticLikeCounts,
}) {
  const restorePost = (post, previousLikes, optimisticLikes) => {
    if (post.id !== postId) return post;
    const patch = {};
    if (post.isLiked === optimisticLiked) patch.isLiked = wasLiked;
    if (
      previousLikes !== undefined
      && optimisticLikes !== undefined
      && normalizeCount(post.likes) === optimisticLikes
    ) patch.likes = previousLikes;
    return Object.keys(patch).length > 0 ? { ...post, ...patch } : post;
  };
  const targetStillOptimistic = state.posts.some(
    (post) => post.id === postId && post.isLiked === optimisticLiked,
  ) || state.myPosts.some(
    (post) => post.id === postId && post.isLiked === optimisticLiked,
  ) || (state.selectedPost?.id === postId && state.selectedPost.isLiked === optimisticLiked)
    || state.likedPosts.includes(postId) === optimisticLiked;
  let postIndex = 0;
  const posts = state.posts.map((post) => {
    if (post.id !== postId) return post;
    const restored = restorePost(
      post,
      previousLikeCounts.posts[postIndex],
      optimisticLikeCounts.posts[postIndex],
    );
    postIndex += 1;
    return restored;
  });
  let myPostIndex = 0;
  const myPosts = state.myPosts.map((post) => {
    if (post.id !== postId) return post;
    const restored = restorePost(
      post,
      previousLikeCounts.myPosts[myPostIndex],
      optimisticLikeCounts.myPosts[myPostIndex],
    );
    myPostIndex += 1;
    return restored;
  });
  const selectedPost = state.selectedPost?.id === postId
    ? restorePost(
      state.selectedPost,
      previousLikeCounts.selectedPost,
      optimisticLikeCounts.selectedPost,
    )
    : state.selectedPost;
  const currentStatsLikes = normalizeCount(state.postStatsById[postId]?.likes);
  let postStatsById = state.postStatsById;
  if (
    targetStillOptimistic
    && currentStatsLikes !== undefined
    && currentStatsLikes === optimisticLikeCounts.stats
  ) {
    const nextEntry = { ...state.postStatsById[postId] };
    if (previousLikeCounts.stats === undefined) delete nextEntry.likes;
    else nextEntry.likes = previousLikeCounts.stats;
    postStatsById = { ...state.postStatsById };
    if (Object.keys(nextEntry).length === 0) delete postStatsById[postId];
    else postStatsById[postId] = nextEntry;
  }

  return {
    posts,
    myPosts,
    selectedPost,
    likedPosts: targetStillOptimistic
      ? (wasLiked
        ? [...new Set([...state.likedPosts, postId])]
        : state.likedPosts.filter((id) => id !== postId))
      : state.likedPosts,
    postStatsById,
  };
}

function settlePostLikeJob(postId, job) {
  if (job.finished) return;
  job.finished = true;
  job.running = false;
  if (pendingPostLikeToggles.get(postId) === job) {
    pendingPostLikeToggles.delete(postId);
  }
  for (const resolve of job.waiters.splice(0)) resolve();
}

async function reconcilePostLike(postId, job, set, get) {
  if (job.running || job.finished) return;
  job.running = true;
  try {
    while (
      !job.finished
      && job.generation === accountGeneration
      && pendingPostLikeToggles.get(postId) === job
    ) {
      if (job.desiredLiked === job.confirmedLiked) {
        set((state) => rollbackOptimisticPostLike(state, postId, {
          wasLiked: job.confirmedLiked,
          optimisticLiked: job.desiredLiked,
          previousLikeCounts: job.confirmedLikeCounts,
          optimisticLikeCounts: job.expectedLikeCounts,
        }));
        break;
      }

      const requestIntentVersion = job.intentVersion;
      let result;
      try {
        result = await postService.toggleLike(postId);
      } catch {
        if (
          job.finished
          || job.generation !== accountGeneration
          || pendingPostLikeToggles.get(postId) !== job
        ) break;
        if (
          job.intentVersion > requestIntentVersion
          && job.desiredLiked !== job.confirmedLiked
        ) continue;
        set((state) => rollbackOptimisticPostLike(state, postId, {
          wasLiked: job.confirmedLiked,
          optimisticLiked: job.desiredLiked,
          previousLikeCounts: job.confirmedLikeCounts,
          optimisticLikeCounts: job.expectedLikeCounts,
        }));
        break;
      }

      if (
        job.finished
        || job.generation !== accountGeneration
        || pendingPostLikeToggles.get(postId) !== job
      ) break;

      job.confirmedLiked = result.liked;
      const resultLikes = normalizeCount(result.likes);
      const confirmedCounts = captureLikeCountsAfterServerResult(get(), postId, resultLikes);
      if (confirmedCounts) job.confirmedLikeCounts = confirmedCounts;

      if (job.desiredLiked === result.liked) {
        set((state) => applyPostLikeState(state, postId, result));
        break;
      }
    }
  } finally {
    settlePostLikeJob(postId, job);
  }
}

const usePostStore = create((set, get) => ({
  posts: [],
  likedPosts: [],
  selectedPost: null,
  loading: false,
  loadingMore: false,
  myPosts: [],
  postStatsById: {},
  currentPage: 1,
  totalPages: 1,
  totalPosts: 0,
  currentQuery: '',
  currentSort: 'latest',
  currentTag: '',
  feedLoaded: false,
  feedError: '',
  moreError: '',
  failedFeedRequest: null,
  pageSize: FEED_PAGE_SIZE,
  pendingUnlikePostIds: [],
  submittingUnlikePostIds: [],

  resetForAccountChange: () => {
    accountGeneration += 1;
    latestFeedRequestId += 1;
    latestMyPostsRequestId += 1;
    for (const [postId, job] of pendingPostLikeToggles) {
      settlePostLikeJob(postId, job);
    }
    pendingPostLikeToggles.clear();
    set({
      posts: [],
      likedPosts: [],
      selectedPost: null,
      loading: false,
      loadingMore: false,
      myPosts: [],
      postStatsById: {},
      currentPage: 1,
      totalPages: 1,
      totalPosts: 0,
      feedLoaded: false,
      feedError: '',
      moreError: '',
      failedFeedRequest: null,
      pendingUnlikePostIds: [],
      submittingUnlikePostIds: [],
    });
  },

  fetchPosts: async (page = 1, query = '', options = {}) => {
    const state = get();
    const normalizedQuery = normalizeFeedQuery(query);
    const normalizedSort = normalizeFeedSort(options.sort ?? state.currentSort);
    const tag = typeof options.tag === 'string' ? options.tag.trim() : state.currentTag;
    const append = options.append === true && page > 1;
    const limit = Number.isFinite(options.limit) ? options.limit : state.pageSize;
    const requestGeneration = accountGeneration;
    const requestId = ++latestFeedRequestId;
    set(append ? { moreError: '' } : { feedError: '', loadingMore: false });
    const shouldShowLoading = !append && !options.silent;

    if (shouldShowLoading) {
      set({ loading: true });
    }
    if (append) {
      set({ loadingMore: true });
    }

    try {
      const data = await postService.fetchPosts(page, normalizedQuery, {
        limit,
        sort: normalizedSort,
        tag,
      });
      if (requestGeneration !== accountGeneration || requestId !== latestFeedRequestId) {
        return null;
      }

      set((state) => ({
        posts: append ? appendUniquePosts(state.posts, data.posts) : data.posts,
        likedPosts: append
          ? mergeLikedPostIds(
            state.likedPosts,
            appendUniquePosts(state.posts, data.posts),
          )
          : data.posts.filter((post) => post.isLiked).map((post) => post.id),
        postStatsById: mergePostStatsMap(state.postStatsById, data.posts),
        currentPage: options.currentPageOverride ?? (append ? page : 1),
        totalPages: Math.max(1, Math.ceil((data.total || 0) / state.pageSize)),
        totalPosts: data.total || 0,
        currentQuery: normalizedQuery,
        currentSort: normalizedSort,
        currentTag: tag,
        feedLoaded: true,
        feedError: '',
        moreError: '',
        failedFeedRequest: null,
        loading: false,
        loadingMore: false,
      }));
      return data;
    } catch (err) {
      if (requestGeneration === accountGeneration && requestId === latestFeedRequestId) {
        set({ loading: false, loadingMore: false, failedFeedRequest: append ? get().failedFeedRequest : { page, query: normalizedQuery, options: { ...options, tag, sort: normalizedSort } }, [append ? 'moreError' : 'feedError']: err.message || '树洞加载失败，请重试。' });
      }
      return null;
    }
  },

  retryFeed: () => {
    const request = get().failedFeedRequest;
    return request ? get().fetchPosts(request.page, request.query, request.options) : null;
  },

  loadMorePosts: async () => {
    const { loading, loadingMore, currentPage, totalPages, currentQuery, currentSort, currentTag } = get();
    if (loading || loadingMore || currentPage >= totalPages) {
      return null;
    }
    return get().fetchPosts(currentPage + 1, currentQuery, {
      append: true,
      sort: currentSort,
      tag: currentTag,
    });
  },

  refreshFeed: async (options = {}) => {
    const { currentPage, currentQuery, currentSort, pageSize } = get();
    const normalizedQuery = normalizeFeedQuery(
      options.query !== undefined ? options.query : currentQuery,
    );
    const normalizedSort = normalizeFeedSort(
      options.sort !== undefined ? options.sort : currentSort,
    );
    const sameQuery = normalizedQuery === currentQuery;
    const sameSort = normalizedSort === currentSort;
    const targetPage = sameQuery && sameSort ? Math.max(1, currentPage) : 1;

    return get().fetchPosts(1, normalizedQuery, {
      silent: options.silent,
      limit: targetPage * pageSize,
      currentPageOverride: targetPage,
      sort: normalizedSort,
    });
  },

  fetchMyPosts: async () => {
    const requestGeneration = accountGeneration;
    const requestId = ++latestMyPostsRequestId;
    try {
      const data = await postService.fetchMyPosts();
      if (requestGeneration !== accountGeneration || requestId !== latestMyPostsRequestId) return null;
      set((state) => ({
        myPosts: data,
        postStatsById: mergePostStatsMap(state.postStatsById, data),
      }));
      return data;
    } catch (error) {
      if (requestGeneration !== accountGeneration || requestId !== latestMyPostsRequestId) return null;
      throw error;
    }
  },

  removePostById: (postId, options = {}) => {
    const shouldClearSelectedPost = options.clearSelectedPost !== false;
    useBookmarkStore.getState().removePostReferences(postId);
    set((state) => ({
      myPosts: state.myPosts.filter((p) => p.id !== postId),
      posts: state.posts.filter((p) => p.id !== postId),
      postStatsById: Object.fromEntries(
        Object.entries(state.postStatsById).filter(([id]) => id !== postId)
      ),
      selectedPost:
        shouldClearSelectedPost && state.selectedPost?.id === postId
          ? null
          : state.selectedPost,
    }));
  },

  clearSelectedPost: () => {
    set({ selectedPost: null });
  },

  deletePost: async (postId, options = {}) => {
    const requestGeneration = accountGeneration;
    await postService.deletePost(postId);
    if (requestGeneration !== accountGeneration) return;
    get().removePostById(postId, options);
  },

  addPost: async (post) => {
    const requestGeneration = accountGeneration;
    const newPost = await postService.createPost(post);
    if (requestGeneration !== accountGeneration) return normalizePost(newPost);
    return get().addPublishedPost(newPost);
  },

  addPublishedPost: (post) => {
    const normalized = normalizePost(post);
    set((state) => ({
      posts: [normalized, ...state.posts.filter((existing) => existing.id !== normalized.id)],
      postStatsById: mergePostStatsMap(state.postStatsById, [normalized]),
    }));
    return normalized;
  },

  isPostPendingUnlike: (postId) => {
    const { pendingUnlikePostIds, submittingUnlikePostIds } = get();
    return pendingUnlikePostIds.includes(postId) || submittingUnlikePostIds.includes(postId);
  },

  isPostLiked: (postId) => {
    const { likedPosts } = get();
    return likedPosts.includes(postId) && !get().isPostPendingUnlike(postId);
  },

  getPostLikeView: (post) => {
    if (!post) return post;
    const state = get();
    const isPendingUnlike = state.isPostPendingUnlike(post.id);
    const knownLikeState = getKnownPostLikeState(state, post.id);
    const postStats = state.postStatsById[post.id] || {};
    const isLiked = typeof knownLikeState === 'boolean'
      ? knownLikeState
      : !!post.isLiked;
    const likes = normalizeCount(postStats.likes) ?? normalizeCount(post.likes) ?? 0;
    const saves = normalizeCount(postStats.saves) ?? normalizeCount(post.saves) ?? 0;
    const comments = normalizeCount(postStats.comments) ?? normalizeCount(post.comments) ?? 0;
    return {
      ...post,
      isLiked: isPendingUnlike ? false : isLiked,
      likes: isPendingUnlike ? Math.max(0, likes - 1) : likes,
      saves,
      comments,
    };
  },

  togglePendingUnlike: (postId) => {
    set((state) => {
      if (state.submittingUnlikePostIds.includes(postId)) return state;
      return {
        pendingUnlikePostIds: state.pendingUnlikePostIds.includes(postId)
          ? state.pendingUnlikePostIds.filter((id) => id !== postId)
          : [...state.pendingUnlikePostIds, postId],
      };
    });
  },

  submitPendingUnlikes: async (postIds) => {
    const requestGeneration = accountGeneration;
    const currentPending = get().pendingUnlikePostIds;
    const targetIds = [...new Set((postIds || currentPending).filter((id) => currentPending.includes(id)))];
    if (targetIds.length === 0) {
      return { succeeded: [], failed: [] };
    }

    set((state) => ({
      pendingUnlikePostIds: state.pendingUnlikePostIds.filter((id) => !targetIds.includes(id)),
      submittingUnlikePostIds: [...new Set([...state.submittingUnlikePostIds, ...targetIds])],
    }));

    const succeeded = [];
    const failed = [];

    for (const postId of targetIds) {
      if (requestGeneration !== accountGeneration) break;
      try {
        const result = await postService.toggleLike(postId);
        if (requestGeneration !== accountGeneration) break;
        succeeded.push({ postId, result });
      } catch (error) {
        if (requestGeneration !== accountGeneration) break;
        failed.push({ postId, error });
      }
    }

    if (requestGeneration !== accountGeneration) {
      return { succeeded: [], failed: [] };
    }

    set((state) => {
      let nextState = {
        ...state,
        submittingUnlikePostIds: state.submittingUnlikePostIds.filter((id) => !targetIds.includes(id)),
      };

      for (const { postId, result } of succeeded) {
        nextState = {
          ...nextState,
          ...applyPostLikeState(nextState, postId, result),
        };
      }

      return nextState;
    });

    return {
      succeeded: succeeded.map(({ postId }) => postId),
      failed: failed.map(({ postId }) => postId),
    };
  },

  toggleLike: (postId) => {
    if (get().isPostPendingUnlike(postId)) {
      set((state) => ({
        pendingUnlikePostIds: state.pendingUnlikePostIds.filter((id) => id !== postId),
      }));
      return Promise.resolve();
    }

    const stateBeforeToggle = get();
    const wasLiked = getKnownPostLikeState(stateBeforeToggle, postId) ?? false;
    const optimisticLiked = !wasLiked;
    const likeDelta = wasLiked ? -1 : 1;
    const currentLikeCounts = capturePostLikeCounts(stateBeforeToggle, postId);
    let job = pendingPostLikeToggles.get(postId);
    if (job) {
      mergeNewerLikeCounts(job, stateBeforeToggle, postId);
    } else {
      job = {
        generation: accountGeneration,
        confirmedLiked: wasLiked,
        desiredLiked: optimisticLiked,
        confirmedLikeCounts: currentLikeCounts,
        expectedLikeCounts: currentLikeCounts,
        intentVersion: 0,
        running: false,
        finished: false,
        waiters: [],
      };
      pendingPostLikeToggles.set(postId, job);
    }

    set((state) => {
      const nextLikes = state.selectedPost?.id === postId
        ? Math.max(0, (normalizeCount(state.selectedPost.likes) ?? 0) + likeDelta)
        : undefined;
      const updatedPosts = state.posts.map((p) =>
        p.id === postId
          ? { ...p, likes: Math.max(0, (normalizeCount(p.likes) ?? 0) + likeDelta), isLiked: optimisticLiked }
          : p,
      );
      return {
        postStatsById: mergePostStatsEntry(
          state.postStatsById,
          postId,
          {
            likes: nextLikes ?? updatedPosts.find((post) => post.id === postId)?.likes,
          },
        ),
        likedPosts: wasLiked
          ? state.likedPosts.filter((id) => id !== postId)
          : [...new Set([...state.likedPosts, postId])],
        posts: updatedPosts,
        myPosts: state.myPosts.map((p) =>
          p.id === postId
            ? { ...p, likes: Math.max(0, (normalizeCount(p.likes) ?? 0) + likeDelta), isLiked: optimisticLiked }
            : p,
        ),
        selectedPost:
          state.selectedPost?.id === postId
            ? {
                ...state.selectedPost,
                likes: Math.max(0, (normalizeCount(state.selectedPost.likes) ?? 0) + likeDelta),
                isLiked: optimisticLiked,
              }
            : state.selectedPost,
      };
    });

    job.desiredLiked = optimisticLiked;
    job.intentVersion += 1;
    job.expectedLikeCounts = capturePostLikeCounts(get(), postId);
    const completion = new Promise((resolve) => job.waiters.push(resolve));
    if (!job.running) void reconcilePostLike(postId, job, set, get);
    return completion;
  },

  toggleSave: async (postId) => {
    const requestGeneration = accountGeneration;
    const previousPosts = get().posts;
    const previousMyPosts = get().myPosts;
    const previousSelected = get().selectedPost;
    const previousPostStatsById = get().postStatsById;
    // Optimistic update
    set((state) => {
      const updatedPosts = state.posts.map((p) =>
        p.id === postId
          ? { ...p, saves: p.isSaved ? p.saves - 1 : p.saves + 1, isSaved: !p.isSaved }
          : p
      );
      const updatedMyPosts = state.myPosts.map((p) =>
        p.id === postId
          ? { ...p, saves: p.isSaved ? p.saves - 1 : p.saves + 1, isSaved: !p.isSaved }
          : p
      );
      return {
        postStatsById: mergePostStatsEntry(
          state.postStatsById,
          postId,
          {
            saves: state.selectedPost?.id === postId
              ? (state.selectedPost.isSaved ? state.selectedPost.saves - 1 : state.selectedPost.saves + 1)
              : updatedPosts.find((post) => post.id === postId)?.saves,
          },
        ),
        posts: updatedPosts,
        selectedPost:
          state.selectedPost?.id === postId
            ? {
                ...state.selectedPost,
                saves: state.selectedPost.isSaved
                  ? state.selectedPost.saves - 1
                  : state.selectedPost.saves + 1,
                isSaved: !state.selectedPost.isSaved,
              }
            : state.selectedPost,
        myPosts: updatedMyPosts,
      };
    });
    try {
      const result = await postService.toggleSave(postId);
      if (requestGeneration === accountGeneration) {
        set((state) => applyPostSaveState(state, postId, result));
      }
    } catch {
      // 完整回滚
      if (requestGeneration === accountGeneration) {
        set({
          posts: previousPosts,
          myPosts: previousMyPosts,
          selectedPost: previousSelected,
          postStatsById: previousPostStatsById,
        });
      }
    }
  },

  syncSaveState: (postId, result) => {
    set((state) => applyPostSaveState(state, postId, {
      saved: !!result?.saved,
      saves: result?.saves || 0,
    }));
  },

  applyRealtimePostStats: (postId, stats) => {
    set((state) => applyPostStatsUpdate(state, postId, stats));
  },

  updateSaves: (postId, increment) => {
    set((state) => {
      const targetPost = state.posts.find((post) => post.id === postId)
        || (state.selectedPost?.id === postId ? state.selectedPost : null)
        || state.myPosts.find((post) => post.id === postId);
      const nextSaves = Math.max(0, (targetPost?.saves || 0) + increment);
      return {
        postStatsById: mergePostStatsEntry(state.postStatsById, postId, { saves: nextSaves }),
        posts: state.posts.map((p) =>
        p.id === postId ? { ...p, saves: Math.max(0, p.saves + increment) } : p,
        ),
        selectedPost:
          state.selectedPost?.id === postId
            ? {
                ...state.selectedPost,
                saves: Math.max(0, state.selectedPost.saves + increment),
              }
            : state.selectedPost,
        myPosts: state.myPosts.map((p) =>
          p.id === postId ? { ...p, saves: Math.max(0, p.saves + increment) } : p,
        ),
      };
    });
  },

  updateCommentCount: (postId, increment) => {
    set((state) => {
      const targetPost = state.posts.find((post) => post.id === postId)
        || (state.selectedPost?.id === postId ? state.selectedPost : null)
        || state.myPosts.find((post) => post.id === postId);
      const nextComments = Math.max(0, (targetPost?.comments || 0) + increment);
      return {
        postStatsById: mergePostStatsEntry(state.postStatsById, postId, { comments: nextComments }),
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, comments: Math.max(0, p.comments + increment) } : p
        ),
        selectedPost:
          state.selectedPost?.id === postId
            ? {
                ...state.selectedPost,
                comments: Math.max(0, (state.selectedPost.comments || 0) + increment),
              }
            : state.selectedPost,
        myPosts: state.myPosts.map((p) =>
          p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 0) + increment) } : p
        ),
      };
    });
  },

  setSelectedPost: (post) => {
    const postView = get().getPostLikeView(post);
    set((state) => ({
      selectedPost: postView,
      postStatsById: mergePostStatsMap(state.postStatsById, [postView]),
    }));
  },

  getFilteredPosts: (query) => {
    const { posts, currentQuery } = get();
    return normalizeFeedQuery(query) === currentQuery
      ? posts
      : posts.filter((post) => matchPostQuery(post, query));
  },
}));

export default usePostStore;
