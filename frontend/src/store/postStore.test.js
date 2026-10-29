import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePostStore from './postStore';
import useBookmarkStore from './bookmarkStore';
import * as postService from '../services/postService';

vi.mock('../services/postService', () => ({
  fetchPosts: vi.fn(),
  fetchPostById: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  toggleLike: vi.fn(),
  toggleSave: vi.fn(),
  fetchLikes: vi.fn(),
  fetchSavedPosts: vi.fn(),
  fetchMyPosts: vi.fn(),
  toggleCommentLike: vi.fn(),
  toggleReplyLike: vi.fn(),
}));

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('postStore fetchPosts', () => {
  beforeEach(() => {
    usePostStore.setState(usePostStore.getInitialState(), true);
    useBookmarkStore.setState(useBookmarkStore.getInitialState(), true);
    vi.clearAllMocks();
  });

  it('shows loading only for the first page load', async () => {
    const deferred = createDeferred();
    postService.fetchPosts.mockReturnValueOnce(deferred.promise);

    const request = usePostStore.getState().fetchPosts();

    expect(usePostStore.getState().loading).toBe(true);

    deferred.resolve({
      posts: [{ id: 'post-1', title: 'First post', isLiked: false }],
      total: 1,
    });
    await request;

    expect(usePostStore.getState().loading).toBe(false);
    expect(postService.fetchPosts).toHaveBeenCalledWith(1, '', { limit: 20, sort: 'latest', tag: '' });
    expect(usePostStore.getState().currentPage).toBe(1);
    expect(usePostStore.getState().totalPosts).toBe(1);
    expect(usePostStore.getState().posts).toEqual([
      { id: 'post-1', title: 'First post', isLiked: false },
    ]);
  });

  it('appends the next page when loading more posts', async () => {
    postService.fetchPosts.mockResolvedValueOnce({
      posts: [{ id: 'post-2', title: 'Second post', isLiked: false }],
      total: 40,
    });

    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', isLiked: false }],
      currentPage: 1,
      totalPages: 2,
      totalPosts: 40,
      currentQuery: 'tree',
      currentSort: 'hot',
      loadingMore: false,
    });

    await usePostStore.getState().loadMorePosts();

    expect(postService.fetchPosts).toHaveBeenCalledWith(2, 'tree', { limit: 20, sort: 'hot', tag: '' });
    expect(usePostStore.getState().currentPage).toBe(2);
    expect(usePostStore.getState().posts).toEqual([
      { id: 'post-1', title: 'First post', isLiked: false },
      { id: 'post-2', title: 'Second post', isLiked: false },
    ]);
  });

  it('refreshes the current feed with enough items to preserve loaded pages', async () => {
    postService.fetchPosts.mockResolvedValueOnce({
      posts: [
        { id: 'post-1', title: 'First post', isLiked: false },
        { id: 'post-2', title: 'Second post', isLiked: false },
      ],
      total: 55,
    });

    usePostStore.setState({
      currentPage: 2,
      currentQuery: 'nju',
      currentSort: 'hot',
      pageSize: 20,
    });

    await usePostStore.getState().refreshFeed({ silent: true });

    expect(postService.fetchPosts).toHaveBeenCalledWith(1, 'nju', { limit: 40, sort: 'hot', tag: '' });
    expect(usePostStore.getState().currentPage).toBe(2);
    expect(usePostStore.getState().totalPages).toBe(3);
  });

  it('overlays realtime stats onto external post snapshots', () => {
    usePostStore.setState({
      posts: [
        {
          id: 'post-1',
          title: 'First post',
          isLiked: false,
          likes: 1,
          saves: 2,
          comments: 3,
        },
      ],
      likedPosts: [],
      loading: false,
    });

    usePostStore.getState().applyRealtimePostStats('post-1', {
      likes: 4,
      saves: 6,
      comments: 8,
    });

    const postView = usePostStore.getState().getPostLikeView({
      id: 'post-1',
      title: 'External snapshot',
      isLiked: false,
      likes: 1,
      saves: 2,
      comments: 3,
    });

    expect(postView.likes).toBe(4);
    expect(postView.saves).toBe(6);
    expect(postView.comments).toBe(8);
    expect(usePostStore.getState().posts[0].likes).toBe(4);
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({
      likes: 4,
      saves: 6,
      comments: 8,
    });
  });

  it('restores post stats cache when optimistic like fails', async () => {
    postService.toggleLike.mockRejectedValueOnce(new Error('like failed'));

    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      myPosts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      selectedPost: { id: 'post-1', title: 'First post', likes: 1, isLiked: false },
      likedPosts: [],
      postStatsById: { 'post-1': { likes: 1, saves: 0 } },
    });

    await usePostStore.getState().toggleLike('post-1');

    expect(usePostStore.getState().posts[0].likes).toBe(1);
    expect(usePostStore.getState().myPosts[0].likes).toBe(1);
    expect(usePostStore.getState().selectedPost.likes).toBe(1);
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({
      likes: 1,
      saves: 0,
    });
  });

  it('rolls back only the target like when newer feed and realtime state arrive', async () => {
    const request = createDeferred();
    postService.toggleLike.mockReturnValueOnce(request.promise);
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      myPosts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      selectedPost: { id: 'post-1', title: 'First post', likes: 1, isLiked: false },
      likedPosts: [],
      postStatsById: { 'post-1': { likes: 1, saves: 0 } },
    });

    const toggleRequest = usePostStore.getState().toggleLike('post-1');
    usePostStore.setState((state) => ({
      posts: [...state.posts, { id: 'post-2', title: 'New SSE post', likes: 8, isLiked: false }],
      myPosts: [...state.myPosts, { id: 'post-2', title: 'New SSE post', likes: 8, isLiked: false }],
      postStatsById: {
        ...state.postStatsById,
        'post-2': { likes: 8, saves: 2, comments: 3 },
      },
    }));
    usePostStore.getState().applyRealtimePostStats('post-2', { likes: 9, saves: 4 });

    request.reject(new Error('like failed'));
    await toggleRequest;

    const state = usePostStore.getState();
    expect(state.posts.map((post) => post.id)).toEqual(['post-1', 'post-2']);
    expect(state.posts[0]).toMatchObject({ likes: 1, isLiked: false });
    expect(state.myPosts[1].id).toBe('post-2');
    expect(state.selectedPost).toMatchObject({ likes: 1, isLiked: false });
    expect(state.postStatsById['post-2']).toEqual({ likes: 9, saves: 4, comments: 3 });
  });

  it('keeps a newer realtime like count for the same post when the request fails', async () => {
    const request = createDeferred();
    postService.toggleLike.mockReturnValueOnce(request.promise);
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      likedPosts: [],
      postStatsById: { 'post-1': { likes: 1, saves: 0 } },
    });

    const toggleRequest = usePostStore.getState().toggleLike('post-1');
    usePostStore.getState().applyRealtimePostStats('post-1', { likes: 7 });
    request.reject(new Error('like failed'));
    await toggleRequest;

    expect(usePostStore.getState().posts[0]).toMatchObject({ likes: 7, isLiked: false });
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({ likes: 7, saves: 0 });
  });

  it('serializes rapid same-post toggles and reconciles to the latest desired state', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    const requests = [firstRequest, secondRequest];
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    postService.toggleLike.mockImplementation(() => {
      const request = requests.shift();
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      return request.promise.finally(() => {
        activeRequests -= 1;
      });
    });
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      likedPosts: [],
      postStatsById: { 'post-1': { likes: 1 } },
    });

    const firstToggle = usePostStore.getState().toggleLike('post-1');
    const secondToggle = usePostStore.getState().toggleLike('post-1');
    expect(usePostStore.getState().posts[0]).toMatchObject({ isLiked: false, likes: 1 });
    expect(postService.toggleLike).toHaveBeenCalledTimes(1);

    firstRequest.resolve({ liked: true, likes: 2 });
    await vi.waitFor(() => expect(postService.toggleLike).toHaveBeenCalledTimes(2));
    expect(usePostStore.getState().posts[0]).toMatchObject({ isLiked: false, likes: 1 });

    secondRequest.resolve({ liked: false, likes: 1 });
    await Promise.all([firstToggle, secondToggle]);

    expect(maximumActiveRequests).toBe(1);
    expect(usePostStore.getState().posts[0]).toMatchObject({ isLiked: false, likes: 1 });
    expect(usePostStore.getState().likedPosts).toEqual([]);
  });

  it('does not send an opposite toggle when an earlier failure leaves the latest intent confirmed', async () => {
    const request = createDeferred();
    postService.toggleLike.mockReturnValueOnce(request.promise);
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 1, isLiked: false }],
      likedPosts: [],
    });

    const firstToggle = usePostStore.getState().toggleLike('post-1');
    const secondToggle = usePostStore.getState().toggleLike('post-1');
    request.reject(new Error('first toggle failed'));
    await Promise.all([firstToggle, secondToggle]);

    expect(postService.toggleLike).toHaveBeenCalledTimes(1);
    expect(usePostStore.getState().posts[0]).toMatchObject({ isLiked: false, likes: 1 });
    expect(usePostStore.getState().likedPosts).toEqual([]);
  });

  it('rolls back a failed final toggle and does not retry it', async () => {
    postService.toggleLike.mockRejectedValueOnce(new Error('toggle failed'));
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', likes: 4, isLiked: false }],
      likedPosts: [],
      postStatsById: { 'post-1': { likes: 4, saves: 0 } },
    });

    await usePostStore.getState().toggleLike('post-1');

    expect(postService.toggleLike).toHaveBeenCalledTimes(1);
    expect(usePostStore.getState().posts[0]).toMatchObject({ isLiked: false, likes: 4 });
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({ likes: 4, saves: 0 });
  });

  it('runs toggles for different posts independently', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    postService.toggleLike.mockImplementation((postId) => (
      postId === 'post-a' ? firstRequest.promise : secondRequest.promise
    ));
    usePostStore.setState({
      posts: [
        { id: 'post-a', title: 'A', likes: 1, isLiked: false },
        { id: 'post-b', title: 'B', likes: 6, isLiked: true },
      ],
      likedPosts: ['post-b'],
    });

    const firstToggle = usePostStore.getState().toggleLike('post-a');
    const secondToggle = usePostStore.getState().toggleLike('post-b');
    expect(postService.toggleLike).toHaveBeenCalledTimes(2);

    firstRequest.resolve({ liked: true, likes: 2 });
    secondRequest.resolve({ liked: false, likes: 5 });
    await Promise.all([firstToggle, secondToggle]);

    expect(usePostStore.getState().posts).toMatchObject([
      { id: 'post-a', isLiked: true, likes: 2 },
      { id: 'post-b', isLiked: false, likes: 5 },
    ]);
    expect(usePostStore.getState().likedPosts).toEqual(['post-a']);
  });

  it('does not continue an old account toggle after the account changes', async () => {
    const request = createDeferred();
    postService.toggleLike.mockReturnValueOnce(request.promise);
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'Old account post', likes: 1, isLiked: false }],
      likedPosts: [],
    });

    const firstToggle = usePostStore.getState().toggleLike('post-1');
    const secondToggle = usePostStore.getState().toggleLike('post-1');
    usePostStore.getState().resetForAccountChange();
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'New account post', likes: 5, isLiked: false }],
      likedPosts: [],
    });
    request.resolve({ liked: true, likes: 6 });
    await request.promise;
    await Promise.all([firstToggle, secondToggle]);

    expect(postService.toggleLike).toHaveBeenCalledTimes(1);
    expect(usePostStore.getState().posts[0]).toMatchObject({
      title: 'New account post',
      isLiked: false,
      likes: 5,
    });
    expect(usePostStore.getState().likedPosts).toEqual([]);
  });

  it('clears account-owned post state and ignores pending feed and profile requests', async () => {
    const feedRequest = createDeferred();
    const myPostsRequest = createDeferred();
    postService.fetchPosts.mockReturnValueOnce(feedRequest.promise);
    postService.fetchMyPosts.mockReturnValueOnce(myPostsRequest.promise);
    usePostStore.setState({
      posts: [{ id: 'old-post', isLiked: true }],
      likedPosts: ['old-post'],
      myPosts: [{ id: 'old-post' }],
      postStatsById: { 'old-post': { likes: 1 } },
      feedLoaded: true,
    });

    const pendingFeed = usePostStore.getState().fetchPosts();
    const pendingMyPosts = usePostStore.getState().fetchMyPosts();
    usePostStore.getState().resetForAccountChange();
    feedRequest.resolve({ posts: [{ id: 'old-post', isLiked: true }], total: 1 });
    myPostsRequest.resolve([{ id: 'old-post', isLiked: true }]);
    await Promise.all([pendingFeed, pendingMyPosts]);

    expect(usePostStore.getState().posts).toEqual([]);
    expect(usePostStore.getState().likedPosts).toEqual([]);
    expect(usePostStore.getState().myPosts).toEqual([]);
    expect(usePostStore.getState().postStatsById).toEqual({});
    expect(usePostStore.getState().feedLoaded).toBe(false);
    expect(usePostStore.getState().loading).toBe(false);
  });

  it('does not requeue a post unlike while its request is in flight', async () => {
    const request = createDeferred();
    postService.toggleLike.mockReturnValueOnce(request.promise);
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'Liked post', likes: 1, isLiked: true }],
      likedPosts: ['post-1'],
      pendingUnlikePostIds: ['post-1'],
    });

    const submitRequest = usePostStore.getState().submitPendingUnlikes();
    expect(usePostStore.getState().submittingUnlikePostIds).toEqual(['post-1']);
    usePostStore.getState().togglePendingUnlike('post-1');
    expect(usePostStore.getState().pendingUnlikePostIds).toEqual([]);

    request.resolve({ liked: false, likes: 0 });
    await submitRequest;

    expect(usePostStore.getState().isPostLiked('post-1')).toBe(false);
    expect(usePostStore.getState().pendingUnlikePostIds).toEqual([]);
  });

  it('prunes bookmark references when a post is removed by realtime sync', () => {
    useBookmarkStore.setState({
      bookmarks: ['post-1', 'post-2'],
      bookmarkFolders: { 'folder-1': ['post-1', 'post-2'], 'folder-2': ['post-1'] },
      pendingBookmarkItem: { id: 'post-1', type: 'post' },
      folderSelectorOpen: true,
    });

    usePostStore.getState().removePostById('post-1');

    expect(useBookmarkStore.getState().bookmarks).toEqual(['post-2']);
    expect(useBookmarkStore.getState().bookmarkFolders).toEqual({ 'folder-1': ['post-2'] });
    expect(useBookmarkStore.getState().pendingBookmarkItem).toBeNull();
    expect(useBookmarkStore.getState().folderSelectorOpen).toBe(false);
  });

  it('prunes bookmark references after the local delete request succeeds', async () => {
    postService.deletePost.mockResolvedValueOnce({});
    useBookmarkStore.setState({
      bookmarks: ['post-1'],
      bookmarkFolders: { 'folder-1': ['post-1'] },
    });

    await usePostStore.getState().deletePost('post-1');

    expect(postService.deletePost).toHaveBeenCalledWith('post-1');
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    expect(useBookmarkStore.getState().bookmarkFolders).toEqual({});
  });

  it('uses selected post values when updating saves outside the post list', () => {
    usePostStore.setState({
      posts: [],
      myPosts: [],
      selectedPost: {
        id: 'post-1',
        title: 'Detail only post',
        saves: 3,
      },
      postStatsById: {},
    });

    usePostStore.getState().updateSaves('post-1', 1);

    expect(usePostStore.getState().selectedPost.saves).toBe(4);
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({
      saves: 4,
    });
  });

  it('updates comment counts across post views and realtime cache', () => {
    usePostStore.setState({
      posts: [{ id: 'post-1', title: 'First post', comments: 1 }],
      myPosts: [{ id: 'post-1', title: 'First post', comments: 1 }],
      selectedPost: { id: 'post-1', title: 'First post', comments: 1 },
      postStatsById: { 'post-1': { likes: 0, saves: 0, comments: 1 } },
    });

    usePostStore.getState().updateCommentCount('post-1', 2);

    expect(usePostStore.getState().posts[0].comments).toBe(3);
    expect(usePostStore.getState().myPosts[0].comments).toBe(3);
    expect(usePostStore.getState().selectedPost.comments).toBe(3);
    expect(usePostStore.getState().postStatsById['post-1']).toEqual({
      likes: 0,
      saves: 0,
      comments: 3,
    });
  });
});

it('keeps the previous feed and sort after a failure, then retries the requested sort and tag', async () => {
  usePostStore.setState(usePostStore.getInitialState(), true);
  const existing = [{ id: 'cached', title: 'Previous result' }];
  usePostStore.setState({ posts: existing, feedLoaded: true, currentSort: 'latest' });
  postService.fetchPosts.mockRejectedValueOnce(new Error('网络失败'));
  await usePostStore.getState().fetchPosts(1, '图书馆', { sort: 'hot', tag: '求助' });
  expect(usePostStore.getState().posts).toEqual(existing);
  expect(usePostStore.getState().currentSort).toBe('latest');
  expect(usePostStore.getState().feedError).toBe('网络失败');
  postService.fetchPosts.mockResolvedValueOnce({ posts: [{ id: 'fresh' }], total: 1 });
  await usePostStore.getState().retryFeed();
  expect(postService.fetchPosts).toHaveBeenLastCalledWith(1, '图书馆', { limit: 20, sort: 'hot', tag: '求助' });
  expect(usePostStore.getState().currentSort).toBe('hot');
  expect(usePostStore.getState().currentTag).toBe('求助');
  expect(usePostStore.getState().feedError).toBe('');
});
