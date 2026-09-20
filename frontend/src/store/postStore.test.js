import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePostStore from './postStore';
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
    expect(postService.fetchPosts).toHaveBeenCalledWith(1, '', { limit: 20, sort: 'latest' });
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

    expect(postService.fetchPosts).toHaveBeenCalledWith(2, 'tree', { limit: 20, sort: 'hot' });
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

    expect(postService.fetchPosts).toHaveBeenCalledWith(1, 'nju', { limit: 40, sort: 'hot' });
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
