import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCommentStore from './commentStore';
import usePostStore from './postStore';
import * as commentService from '../services/commentService';

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
});
