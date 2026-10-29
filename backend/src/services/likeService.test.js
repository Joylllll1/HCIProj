import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import { getUserLikes } from './likeService.js';

afterEach(() => mock.restoreAll());

test('liked comments and replies from deleted posts are omitted', async () => {
  const userId = 'user-1';
  const likedComments = [
    {
      _id: 'deleted-comment',
      postId: { _id: 'deleted-post', title: '已删除帖子', isDeleted: true },
      likedBy: [userId],
      replies: [{ _id: 'deleted-reply', likedBy: [userId], isDeleted: false }],
    },
    {
      _id: 'active-comment',
      postId: { _id: 'active-post', title: '仍有效帖子', isDeleted: false },
      likedBy: [userId],
      content: '评论',
      replies: [{ _id: 'active-reply', likedBy: [userId], isDeleted: false, content: '回复' }],
    },
  ];
  mock.method(Post, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));
  mock.method(Comment, 'find', () => {
    const query = {
      populate: () => query,
      sort: () => query,
      lean: async () => likedComments,
    };
    return query;
  });

  const result = await getUserLikes(userId);

  assert.deepEqual(result.comments.map(({ type, item }) => [type, item.id]), [
    ['comment', 'active-comment'],
    ['reply', 'active-reply'],
  ]);
  assert.equal(result.comments.every((entry) => entry.postId === 'active-post'), true);
  assert.equal(result.comments.every((entry) => entry.postIsDeleted === false), true);
});

test('liked post image payloads use media URLs instead of stored values', async () => {
  const postId = new mongoose.Types.ObjectId();
  mock.method(Post, 'find', () => ({
    sort: () => ({
      lean: async () => [{
        _id: postId,
        title: '已点赞帖子',
        content: '正文',
        images: ['data:image/png;base64,AA=='],
        likedBy: ['user-1'],
      }],
    }),
  }));
  mock.method(Comment, 'aggregate', async () => []);
  mock.method(Comment, 'find', () => {
    const query = {
      populate: () => query,
      sort: () => query,
      lean: async () => [],
    };
    return query;
  });

  const result = await getUserLikes('user-1');

  assert.match(result.posts[0].images[0], new RegExp(`^/api/media/posts/${postId}/0\\?v=`));
  assert.equal(result.posts[0].image, result.posts[0].images[0]);
  assert.equal(JSON.stringify(result).includes('data:image/'), false);
});
