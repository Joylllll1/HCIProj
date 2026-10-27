import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCommentStore from './commentStore';
import usePostStore from './postStore';
import * as commentService from '../services/commentService';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setPostCommentCount(postId, comments) {
  const post = { id: postId, comments };
  usePostStore.setState({
    posts: [post],
    myPosts: [post],
    selectedPost: post,
    postStatsById: { [postId]: { likes: 0, saves: 0, comments } },
  });
}

function applyCommentCountEvent(postId, comments) {
  usePostStore.getState().applyRealtimePostStats(postId, { comments });
}

vi.mock('../services/commentService', () => ({
  createComment: vi.fn(),
  getComments: vi.fn(),
  deleteComment: vi.fn(),
  toggleLike: vi.fn(),
  addReply: vi.fn(),
  toggleReplyLike: vi.fn(),
  deleteReply: vi.fn(),
}));

describe('commentStore post count sync', () => {
  beforeEach(() => {
    useCommentStore.setState(useCommentStore.getInitialState(), true);
    usePostStore.setState(usePostStore.getInitialState(), true);
    vi.clearAllMocks();
  });

  it('increments post comment count after creating a comment', async () => {
    commentService.createComment.mockResolvedValueOnce({
      id: 'comment-1',
      content: 'hello',
      replies: [],
    });

    usePostStore.setState({
      posts: [{ id: 'post-1', comments: 1 }],
      myPosts: [{ id: 'post-1', comments: 1 }],
      selectedPost: { id: 'post-1', comments: 1 },
      postStatsById: { 'post-1': { likes: 0, saves: 0, comments: 1 } },
    });

    await useCommentStore.getState().addComment('post-1', 'hello');

    expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(1);
    expect(usePostStore.getState().selectedPost.comments).toBe(2);
    expect(usePostStore.getState().postStatsById['post-1'].comments).toBe(2);
  });

  it('syncs a pending comment creation from GET before its HTTP response', async () => {
    const createRequest = createDeferred();
    const fetchRequest = createDeferred();
    commentService.createComment.mockReturnValueOnce(createRequest.promise);
    commentService.getComments.mockReturnValueOnce(fetchRequest.promise);
    useCommentStore.setState({
      commentsMap: { 'post-1': [{ id: 'comment-old', replies: [] }] },
    });
    setPostCommentCount('post-1', 1);

    const creating = useCommentStore.getState().addComment('post-1', 'new comment');
    const fetching = useCommentStore.getState().fetchComments('post-1');
    fetchRequest.resolve([
      { id: 'comment-old', replies: [] },
      { id: 'comment-new', replies: [] },
    ]);
    await fetching;

    expect(usePostStore.getState().posts[0].comments).toBe(2);
    createRequest.resolve({ id: 'comment-new', replies: [] });
    await creating;

    expect(usePostStore.getState().posts[0].comments).toBe(2);
  });

  it('increments post comment count after creating a reply', async () => {
    commentService.addReply.mockResolvedValueOnce({
      id: 'reply-1',
      content: 'reply',
    });

    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', content: 'parent', replies: [] }],
      },
    });
    usePostStore.setState({
      posts: [{ id: 'post-1', comments: 1 }],
      myPosts: [{ id: 'post-1', comments: 1 }],
      selectedPost: { id: 'post-1', comments: 1 },
      postStatsById: { 'post-1': { likes: 0, saves: 0, comments: 1 } },
    });

    await useCommentStore.getState().addReply('comment-1', 'reply');

    expect(useCommentStore.getState().commentsMap['post-1'][0].replies).toHaveLength(1);
    expect(usePostStore.getState().selectedPost.comments).toBe(2);
    expect(usePostStore.getState().postStatsById['post-1'].comments).toBe(2);
  });

  it('syncs a pending reply creation from GET before its HTTP response', async () => {
    const createRequest = createDeferred();
    const fetchRequest = createDeferred();
    commentService.addReply.mockReturnValueOnce(createRequest.promise);
    commentService.getComments.mockReturnValueOnce(fetchRequest.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', replies: [{ id: 'reply-old' }] }],
      },
    });
    setPostCommentCount('post-1', 2);

    const creating = useCommentStore.getState().addReply('comment-1', 'new reply');
    const fetching = useCommentStore.getState().fetchComments('post-1');
    fetchRequest.resolve([{
      id: 'comment-1',
      replies: [{ id: 'reply-old' }, { id: 'reply-new' }],
    }]);
    await fetching;

    expect(usePostStore.getState().posts[0].comments).toBe(3);
    createRequest.resolve({ id: 'reply-new' });
    await creating;

    expect(usePostStore.getState().posts[0].comments).toBe(3);
  });

  it('decrements post comment count by deleted comment subtree size', async () => {
    commentService.deleteComment.mockResolvedValueOnce({
      postId: 'post-1',
      commentId: 'comment-1',
      deletedReplyCount: 2,
    });

    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            content: 'parent',
            replies: [{ id: 'reply-1' }, { id: 'reply-2' }],
          },
        ],
      },
    });
    usePostStore.setState({
      posts: [{ id: 'post-1', comments: 3 }],
      myPosts: [{ id: 'post-1', comments: 3 }],
      selectedPost: { id: 'post-1', comments: 3 },
      postStatsById: { 'post-1': { likes: 0, saves: 0, comments: 3 } },
    });

    await useCommentStore.getState().deleteComment('comment-1');

    expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(0);
    expect(usePostStore.getState().selectedPost.comments).toBe(0);
    expect(usePostStore.getState().postStatsById['post-1'].comments).toBe(0);
  });

  it('syncs a pending comment deletion from GET before its HTTP response', async () => {
    const deleteRequest = createDeferred();
    const fetchRequest = createDeferred();
    commentService.deleteComment.mockReturnValueOnce(deleteRequest.promise);
    commentService.getComments.mockReturnValueOnce(fetchRequest.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          { id: 'comment-delete', replies: [{ id: 'reply-delete' }] },
          { id: 'comment-keep', replies: [] },
        ],
      },
    });
    setPostCommentCount('post-1', 3);

    const deleting = useCommentStore.getState().deleteComment('comment-delete');
    const fetching = useCommentStore.getState().fetchComments('post-1');
    fetchRequest.resolve([{ id: 'comment-keep', replies: [] }]);
    await fetching;

    expect(usePostStore.getState().posts[0].comments).toBe(1);
    deleteRequest.resolve({
      postId: 'post-1', commentId: 'comment-delete', deletedReplyCount: 1,
    });
    await deleting;

    expect(usePostStore.getState().posts[0].comments).toBe(1);
  });

  it('decrements post comment count after deleting a reply', async () => {
    commentService.deleteReply.mockResolvedValueOnce({
      postId: 'post-1',
      commentId: 'comment-1',
      replyId: 'reply-1',
    });

    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            content: 'parent',
            replies: [{ id: 'reply-1' }],
          },
        ],
      },
    });
    usePostStore.setState({
      posts: [{ id: 'post-1', comments: 2 }],
      myPosts: [{ id: 'post-1', comments: 2 }],
      selectedPost: { id: 'post-1', comments: 2 },
      postStatsById: { 'post-1': { likes: 0, saves: 0, comments: 2 } },
    });

    await useCommentStore.getState().deleteReply('comment-1', 'reply-1');

    expect(useCommentStore.getState().commentsMap['post-1'][0].replies).toHaveLength(0);
    expect(usePostStore.getState().selectedPost.comments).toBe(1);
    expect(usePostStore.getState().postStatsById['post-1'].comments).toBe(1);
  });

  it('syncs a pending reply deletion from GET before its HTTP response', async () => {
    const deleteRequest = createDeferred();
    const fetchRequest = createDeferred();
    commentService.deleteReply.mockReturnValueOnce(deleteRequest.promise);
    commentService.getComments.mockReturnValueOnce(fetchRequest.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{
          id: 'comment-1',
          replies: [{ id: 'reply-delete' }, { id: 'reply-keep' }],
        }],
      },
    });
    setPostCommentCount('post-1', 3);

    const deleting = useCommentStore.getState().deleteReply('comment-1', 'reply-delete');
    const fetching = useCommentStore.getState().fetchComments('post-1');
    fetchRequest.resolve([{
      id: 'comment-1',
      replies: [{ id: 'reply-keep' }],
    }]);
    await fetching;

    expect(usePostStore.getState().posts[0].comments).toBe(2);
    deleteRequest.resolve({
      postId: 'post-1', commentId: 'comment-1', replyId: 'reply-delete',
    });
    await deleting;

    expect(usePostStore.getState().posts[0].comments).toBe(2);
  });

  it('keeps the count correct when the create event, HTTP response, and stats arrive in sequence', async () => {
    const request = createDeferred();
    commentService.createComment.mockReturnValueOnce(request.promise);
    setPostCommentCount('post-1', 1);

    const createRequest = useCommentStore.getState().addComment('post-1', 'hello');
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-1', content: 'hello', replies: [],
    });
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-1', content: 'hello', replies: [],
    });
    request.resolve({ id: 'comment-1', content: 'hello', replies: [] });
    await createRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(1);
    expect(usePostStore.getState().posts[0].comments).toBe(1);
    applyCommentCountEvent('post-1', 2);
    expect(usePostStore.getState().posts[0].comments).toBe(2);
  });

  it('does not count a comment twice when its create event and stats arrive before HTTP', async () => {
    const request = createDeferred();
    commentService.createComment.mockReturnValueOnce(request.promise);
    setPostCommentCount('post-1', 1);

    const createRequest = useCommentStore.getState().addComment('post-1', 'hello');
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-1', content: 'hello', replies: [],
    });
    applyCommentCountEvent('post-1', 2);
    request.resolve({ id: 'comment-1', content: 'hello', replies: [] });
    await createRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(1);
    expect(usePostStore.getState().posts[0].comments).toBe(2);
  });

  it('keeps the immediate HTTP count when HTTP precedes the create event and stats', async () => {
    const request = createDeferred();
    commentService.addReply.mockReturnValueOnce(request.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', content: 'parent', replies: [] }],
      },
    });
    setPostCommentCount('post-1', 1);

    const createRequest = useCommentStore.getState().addReply('comment-1', 'reply');
    request.resolve({ id: 'reply-1', content: 'reply' });
    await createRequest;

    expect(usePostStore.getState().posts[0].comments).toBe(2);
    useCommentStore.getState().upsertReply('post-1', 'comment-1', {
      id: 'reply-1', content: 'reply',
    });
    useCommentStore.getState().upsertReply('post-1', 'comment-1', {
      id: 'reply-1', content: 'reply',
    });
    applyCommentCountEvent('post-1', 2);
    expect(usePostStore.getState().posts[0].comments).toBe(2);
  });

  it('does not decrement a deleted comment subtree twice when SSE precedes HTTP', async () => {
    const request = createDeferred();
    commentService.deleteComment.mockReturnValueOnce(request.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{
          id: 'comment-1',
          replies: [{ id: 'reply-1' }, { id: 'reply-2' }],
        }],
      },
    });
    setPostCommentCount('post-1', 3);

    const deleteRequest = useCommentStore.getState().deleteComment('comment-1');
    useCommentStore.getState().removeComment('post-1', 'comment-1');
    useCommentStore.getState().removeComment('post-1', 'comment-1');
    applyCommentCountEvent('post-1', 0);
    request.resolve({
      postId: 'post-1', commentId: 'comment-1', deletedReplyCount: 2,
    });
    await deleteRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([]);
    expect(usePostStore.getState().posts[0].comments).toBe(0);
  });

  it('decrements a deleted reply once when HTTP precedes SSE stats', async () => {
    const request = createDeferred();
    commentService.deleteReply.mockReturnValueOnce(request.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', replies: [{ id: 'reply-1' }] }],
      },
    });
    setPostCommentCount('post-1', 2);

    const deleteRequest = useCommentStore.getState().deleteReply('comment-1', 'reply-1');
    request.resolve({ postId: 'post-1', commentId: 'comment-1', replyId: 'reply-1' });
    await deleteRequest;
    useCommentStore.getState().removeReply('post-1', 'comment-1', 'reply-1');
    applyCommentCountEvent('post-1', 1);

    expect(useCommentStore.getState().commentsMap['post-1'][0].replies).toEqual([]);
    expect(usePostStore.getState().posts[0].comments).toBe(1);
  });

  it('does not decrement a reply twice when its delete event precedes HTTP', async () => {
    const request = createDeferred();
    commentService.deleteReply.mockReturnValueOnce(request.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', replies: [{ id: 'reply-1' }] }],
      },
    });
    setPostCommentCount('post-1', 2);

    const deleteRequest = useCommentStore.getState().deleteReply('comment-1', 'reply-1');
    useCommentStore.getState().removeReply('post-1', 'comment-1', 'reply-1');
    useCommentStore.getState().removeReply('post-1', 'comment-1', 'reply-1');
    applyCommentCountEvent('post-1', 1);
    request.resolve({ postId: 'post-1', commentId: 'comment-1', replyId: 'reply-1' });
    await deleteRequest;

    expect(useCommentStore.getState().commentsMap['post-1'][0].replies).toEqual([]);
    expect(usePostStore.getState().posts[0].comments).toBe(1);
  });

  it('ignores comment mutation completions from an earlier account', async () => {
    const createCommentRequest = createDeferred();
    const addReplyRequest = createDeferred();
    const deleteCommentRequest = createDeferred();
    const deleteReplyRequest = createDeferred();
    commentService.createComment.mockReturnValueOnce(createCommentRequest.promise);
    commentService.addReply.mockReturnValueOnce(addReplyRequest.promise);
    commentService.deleteComment.mockReturnValueOnce(deleteCommentRequest.promise);
    commentService.deleteReply.mockReturnValueOnce(deleteReplyRequest.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{ id: 'comment-1', replies: [{ id: 'reply-1' }] }],
      },
    });
    setPostCommentCount('post-1', 3);

    const requests = [
      useCommentStore.getState().addComment('post-1', 'old account'),
      useCommentStore.getState().addReply('comment-1', 'old reply'),
      useCommentStore.getState().deleteComment('comment-1'),
      useCommentStore.getState().deleteReply('comment-1', 'reply-1'),
    ];
    useCommentStore.getState().resetForAccountChange();
    setPostCommentCount('post-1', 7);

    createCommentRequest.resolve({ id: 'old-comment', replies: [] });
    addReplyRequest.resolve({ id: 'old-reply' });
    deleteCommentRequest.resolve({
      postId: 'post-1', commentId: 'comment-1', deletedReplyCount: 1,
    });
    deleteReplyRequest.resolve({ postId: 'post-1', commentId: 'comment-1', replyId: 'reply-1' });
    await Promise.all(requests);

    expect(useCommentStore.getState().commentsMap).toEqual({});
    expect(usePostStore.getState().posts[0].comments).toBe(7);
  });

  it('merges local comment and reply changes made while a fetch is pending', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          { id: 'comment-1', content: 'before fetch', replies: [{ id: 'reply-1', content: 'old reply' }] },
          { id: 'comment-2', content: 'removed during fetch', replies: [] },
        ],
      },
    });

    const fetchRequest = useCommentStore.getState().fetchComments('post-1');
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-3', content: 'new local comment', replies: [],
    });
    useCommentStore.getState().removeComment('post-1', 'comment-2');
    useCommentStore.getState().upsertReply('post-1', 'comment-1', {
      id: 'reply-2', content: 'new local reply',
    });
    useCommentStore.getState().removeReply('post-1', 'comment-1', 'reply-1');

    request.resolve([
      { id: 'comment-1', content: 'stale response', replies: [{ id: 'reply-1', content: 'old reply' }] },
      { id: 'comment-2', content: 'removed during fetch', replies: [] },
      { id: 'comment-4', content: 'new server comment', replies: [] },
    ]);
    await fetchRequest;

    const comments = useCommentStore.getState().commentsMap['post-1'];
    expect(comments.map((comment) => comment.id)).toEqual(['comment-1', 'comment-4', 'comment-3']);
    expect(comments[0]).toMatchObject({
      content: 'stale response',
      replies: [{ id: 'reply-2', content: 'new local reply' }],
    });
    expect(useCommentStore.getState().loadedPostIds['post-1']).toBe(true);
  });

  it('does not resurrect a comment created and deleted while the initial fetch is pending', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);

    const fetchRequest = useCommentStore.getState().fetchComments('post-1');
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-1', content: 'created and removed', replies: [],
    });
    useCommentStore.getState().removeComment('post-1', 'comment-1');

    request.resolve([{ id: 'comment-1', content: 'stale server copy', replies: [] }]);
    await fetchRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([]);
    expect(useCommentStore.getState().fetchMutationsByPost['post-1']).toBeUndefined();
  });

  it('replays unseen comment and reply deletions over a pending fetch', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);

    const fetchRequest = useCommentStore.getState().fetchComments('post-1');
    useCommentStore.getState().removeComment('post-1', 'deleted-comment');
    useCommentStore.getState().removeReply('post-1', 'comment-parent', 'deleted-reply');

    request.resolve([
      { id: 'deleted-comment', content: 'stale comment', replies: [] },
      {
        id: 'comment-parent',
        content: 'parent',
        replies: [{ id: 'deleted-reply', content: 'stale reply' }],
      },
    ]);
    await fetchRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([
      { id: 'comment-parent', content: 'parent', replies: [] },
    ]);
  });

  it('replays a reply event for a parent that was not cached when fetching began', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);

    const fetchRequest = useCommentStore.getState().fetchComments('post-1');
    useCommentStore.getState().upsertReply('post-1', 'comment-parent', {
      id: 'reply-live', content: 'SSE reply',
    });

    request.resolve([{ id: 'comment-parent', content: 'parent', replies: [] }]);
    await fetchRequest;

    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([
      {
        id: 'comment-parent',
        content: 'parent',
        replies: [{ id: 'reply-live', content: 'SSE reply' }],
      },
    ]);
  });

  it('keeps fetched replies alongside a local like and reply update', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);
    commentService.toggleLike.mockResolvedValueOnce({ liked: true, likes: 4 });
    useCommentStore.setState({
      commentsMap: { 'post-1': [{ id: 'comment-parent', content: 'parent', isLiked: false, likes: 2, replies: [] }] },
    });

    const fetchRequest = useCommentStore.getState().fetchComments('post-1');
    const likeRequest = useCommentStore.getState().toggleLike('comment-parent');
    useCommentStore.getState().upsertReply('post-1', 'comment-parent', {
      id: 'reply-local', content: 'local reply',
    });
    request.resolve([{
      id: 'comment-parent',
      content: 'server parent',
      isLiked: false,
      likes: 2,
      replies: [{ id: 'reply-server', content: 'server reply' }],
    }]);
    await Promise.all([fetchRequest, likeRequest]);

    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([{
      id: 'comment-parent',
      content: 'server parent',
      isLiked: true,
      likes: 3,
      replies: [
        { id: 'reply-server', content: 'server reply' },
        { id: 'reply-local', content: 'local reply' },
      ],
    }]);
  });

  it('keeps fetched comments, SSE additions, replies, and other likes after a comment like fails', async () => {
    const fetchRequest = createDeferred();
    const likeRequest = createDeferred();
    commentService.getComments.mockReturnValueOnce(fetchRequest.promise);
    commentService.toggleLike
      .mockReturnValueOnce(likeRequest.promise)
      .mockResolvedValueOnce({ liked: true, likes: 3 });
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-parent',
            content: 'original parent',
            isLiked: false,
            likes: 2,
            replies: [],
          },
          { id: 'comment-other', content: 'other', isLiked: false, likes: 2, replies: [] },
        ],
      },
    });

    const pendingFetch = useCommentStore.getState().fetchComments('post-1');
    const failedLike = useCommentStore.getState().toggleLike('comment-parent');
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-parent', content: 'edited by SSE', likes: 8,
    });
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-live', content: 'new SSE comment', replies: [],
    });
    useCommentStore.getState().upsertReply('post-1', 'comment-parent', {
      id: 'reply-live', content: 'new SSE reply',
    });
    const otherLike = useCommentStore.getState().toggleLike('comment-other');

    fetchRequest.resolve([
      {
        id: 'comment-parent', content: 'stale fetch parent', isLiked: false, likes: 2, replies: [],
      },
      { id: 'comment-other', content: 'other', isLiked: false, likes: 2, replies: [] },
    ]);
    await Promise.all([pendingFetch, otherLike]);
    likeRequest.reject(new Error('like failed'));
    await failedLike;

    const comments = useCommentStore.getState().commentsMap['post-1'];
    expect(comments.map((comment) => comment.id)).toEqual([
      'comment-parent', 'comment-other', 'comment-live',
    ]);
    expect(comments[0]).toMatchObject({
      content: 'edited by SSE',
      isLiked: false,
      likes: 8,
      replies: [{ id: 'reply-live', content: 'new SSE reply' }],
    });
    expect(comments[1]).toMatchObject({ isLiked: true, likes: 3 });
  });

  it('rolls back only the target reply like when a reply failure arrives after SSE changes', async () => {
    const likeRequest = createDeferred();
    commentService.toggleReplyLike.mockReturnValueOnce(likeRequest.promise);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [{
          id: 'comment-parent',
          content: 'parent',
          replies: [{ id: 'reply-target', content: 'reply', isLiked: false, likes: 1 }],
        }],
      },
    });

    const failedLike = useCommentStore.getState().toggleReplyLike('comment-parent', 'reply-target');
    useCommentStore.getState().upsertReply('post-1', 'comment-parent', {
      id: 'reply-target', content: 'edited by SSE', likes: 7,
    });
    useCommentStore.getState().upsertReply('post-1', 'comment-parent', {
      id: 'reply-live', content: 'new SSE reply',
    });
    useCommentStore.getState().upsertComment('post-1', {
      id: 'comment-live', content: 'new SSE comment', replies: [],
    });

    likeRequest.reject(new Error('reply like failed'));
    await failedLike;

    const comments = useCommentStore.getState().commentsMap['post-1'];
    expect(comments.map((comment) => comment.id)).toEqual(['comment-parent', 'comment-live']);
    expect(comments[0].replies).toEqual([
      { id: 'reply-target', content: 'edited by SSE', isLiked: false, likes: 7 },
      { id: 'reply-live', content: 'new SSE reply' },
    ]);
  });

  it('clears account-scoped comments and ignores a fetch started for the prior account', async () => {
    const request = createDeferred();
    commentService.getComments.mockReturnValueOnce(request.promise);
    const fetchRequest = useCommentStore.getState().fetchComments('post-1');

    useCommentStore.getState().resetForAccountChange();
    request.resolve([{ id: 'old-user-comment', content: 'private', replies: [] }]);
    await fetchRequest;

    expect(useCommentStore.getState().commentsMap).toEqual({});
    expect(useCommentStore.getState().loadedPostIds).toEqual({});
    expect(useCommentStore.getState().loadStates).toEqual({});
    expect(useCommentStore.getState().fetchMutationsByPost).toEqual({});
  });

  it('keeps an untouched fetch authoritative and allows a failed load to retry', async () => {
    commentService.getComments
      .mockRejectedValueOnce(new Error('网络失败'))
      .mockResolvedValueOnce([{ id: 'server-comment', content: '最新评论', replies: [] }]);
    useCommentStore.setState({
      commentsMap: { 'post-1': [{ id: 'old-comment', content: '旧评论', replies: [] }] },
    });

    await useCommentStore.getState().fetchComments('post-1');
    expect(useCommentStore.getState().loadStates['post-1']).toEqual({
      loading: false,
      error: '网络失败',
    });

    await useCommentStore.getState().fetchComments('post-1');
    expect(useCommentStore.getState().commentsMap['post-1']).toEqual([
      { id: 'server-comment', content: '最新评论', replies: [] },
    ]);
    expect(commentService.getComments).toHaveBeenCalledTimes(2);
    expect(useCommentStore.getState().loadStates['post-1']).toEqual({ loading: false, error: '' });
  });

  it('does not requeue a comment unlike while its request is in flight', async () => {
    const request = createDeferred();
    commentService.toggleLike.mockReturnValueOnce(request.promise);
    const item = { type: 'comment', id: 'comment-1', parentId: null };
    useCommentStore.setState({
      commentsMap: { 'post-1': [{ id: 'comment-1', isLiked: true, likes: 1, replies: [] }] },
      pendingCommentUnlikes: [item],
    });

    const submitRequest = useCommentStore.getState().submitPendingCommentUnlikes();
    expect(useCommentStore.getState().submittingCommentUnlikes).toEqual([item]);
    useCommentStore.getState().togglePendingUnlike(item);
    expect(useCommentStore.getState().pendingCommentUnlikes).toEqual([]);

    request.resolve({ liked: false, likes: 0 });
    await submitRequest;

    expect(useCommentStore.getState().commentsMap['post-1'][0]).toMatchObject({
      isLiked: false,
      likes: 0,
    });
    expect(useCommentStore.getState().pendingCommentUnlikes).toEqual([]);
  });
});
