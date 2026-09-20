import { create } from 'zustand';
import * as postService from '../services/postService';
import { matchPostQuery } from '../utils/search';

const FEED_PAGE_SIZE = 20;
let latestFeedRequestId = 0;

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
  pageSize: FEED_PAGE_SIZE,
  pendingUnlikePostIds: [],
  submittingUnlikePostIds: [],

  fetchPosts: async (page = 1, query = '', options = {}) => {
    const state = get();
    const normalizedQuery = normalizeFeedQuery(query);
    const normalizedSort = normalizeFeedSort(options.sort ?? state.currentSort);
    const append = options.append === true && page > 1;
    const limit = Number.isFinite(options.limit) ? options.limit : state.pageSize;
    const requestId = ++latestFeedRequestId;
    const shouldShowLoading = !append
      && !options.silent
      && (
        state.posts.length === 0
        || normalizedQuery !== state.currentQuery
        || normalizedSort !== state.currentSort
      );

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
      });
      if (requestId !== latestFeedRequestId) {
        return data;
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
        loading: false,
        loadingMore: false,
      }));
      return data;
    } catch {
      if (requestId === latestFeedRequestId) {
        set({ loading: false, loadingMore: false });
      }
      return null;
    }
  },

  loadMorePosts: async () => {
    const { loadingMore, currentPage, totalPages, currentQuery, currentSort } = get();
    if (loadingMore || currentPage >= totalPages) {
      return null;
    }
    return get().fetchPosts(currentPage + 1, currentQuery, {
      append: true,
      sort: currentSort,
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
    const data = await postService.fetchMyPosts();
    set((state) => ({
      myPosts: data,
      postStatsById: mergePostStatsMap(state.postStatsById, data),
    }));
    return data;
  },

  removePostById: (postId, options = {}) => {
    const shouldClearSelectedPost = options.clearSelectedPost !== false;
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
    await postService.deletePost(postId);
    get().removePostById(postId, options);
  },

  addPost: async (post) => {
    const newPost = await postService.createPost(post);
    const normalized = { ...newPost, id: newPost.id || newPost._id?.toString() };
    set((state) => ({
      posts: [normalized, ...state.posts],
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
    set((state) => ({
      pendingUnlikePostIds: state.pendingUnlikePostIds.includes(postId)
        ? state.pendingUnlikePostIds.filter((id) => id !== postId)
        : [...state.pendingUnlikePostIds, postId],
    }));
  },

  submitPendingUnlikes: async (postIds) => {
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
      try {
        const result = await postService.toggleLike(postId);
        succeeded.push({ postId, result });
      } catch (error) {
        failed.push({ postId, error });
      }
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

  toggleLike: async (postId) => {
    if (get().isPostPendingUnlike(postId)) {
      set((state) => ({
        pendingUnlikePostIds: state.pendingUnlikePostIds.filter((id) => id !== postId),
      }));
      return;
    }

    const previousPosts = get().posts;
    const previousMyPosts = get().myPosts;
    const previousSelected = get().selectedPost;
    const previousLiked = get().likedPosts;
    const previousPostStatsById = get().postStatsById;
    const wasLiked = previousLiked.includes(postId);
    set((state) => {
      const nextLikes = state.selectedPost?.id === postId
        ? (wasLiked ? state.selectedPost.likes - 1 : state.selectedPost.likes + 1)
        : undefined;
      const updatedPosts = state.posts.map((p) =>
        p.id === postId
          ? { ...p, likes: wasLiked ? p.likes - 1 : p.likes + 1, isLiked: !wasLiked }
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
          : [...state.likedPosts, postId],
        posts: updatedPosts,
        myPosts: state.myPosts.map((p) =>
          p.id === postId
            ? { ...p, likes: wasLiked ? p.likes - 1 : p.likes + 1, isLiked: !wasLiked }
            : p,
        ),
        selectedPost:
          state.selectedPost?.id === postId
            ? {
                ...state.selectedPost,
                likes: wasLiked
                  ? state.selectedPost.likes - 1
                  : state.selectedPost.likes + 1,
                isLiked: !wasLiked,
              }
            : state.selectedPost,
      };
    });
    try {
      const result = await postService.toggleLike(postId);
      set((state) => applyPostLikeState(state, postId, result));
    } catch {
      // 完整回滚：防止 API 失败时 likedPosts 和 posts 不同步导致的计数偏移
      set({
        posts: previousPosts,
        myPosts: previousMyPosts,
        selectedPost: previousSelected,
        likedPosts: previousLiked,
        postStatsById: previousPostStatsById,
      });
    }
  },

  toggleSave: async (postId) => {
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
      set((state) => applyPostSaveState(state, postId, result));
    } catch {
      // 完整回滚
      set({
        posts: previousPosts,
        myPosts: previousMyPosts,
        selectedPost: previousSelected,
        postStatsById: previousPostStatsById,
      });
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
