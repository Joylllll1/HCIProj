import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import * as commentController from '../controllers/commentController.js';
import { addClient, removeClient } from './sseManager.js';
import {
  addReply,
  createComment,
  deleteComment,
  deleteReply,
  getComments,
  toggleLike,
  toggleReplyLike,
} from './commentService.js';

const postId = '507f1f77bcf86cd799439011';
const commentId = '507f1f77bcf86cd799439012';
const replyId = '507f1f77bcf86cd799439013';

afterEach(() => mock.restoreAll());

function captureEvents(t) {
  const writes = [];
  const userId = `comment-service-test-${Math.random()}`;
  const client = addClient(userId, { write: (payload) => writes.push(payload) });
  t.after(() => removeClient(userId, client));
  return () => writes.map((payload) => {
    const [, event] = payload.match(/^event: ([^\n]+)/);
    const [, data] = payload.match(/\ndata: (.+)\n\n$/);
    return { event, data: JSON.parse(data) };
  });
}

function mockCommentCountSync() {
  mock.method(Comment, 'aggregate', async () => []);
  mock.method(Post, 'findByIdAndUpdate', async () => null);
}

function makeCommentWithReply() {
  const replies = [];
  replies.id = (id) => replies.find((reply) => reply._id.toString() === id.toString());
  const reply = { _id: new mongoose.Types.ObjectId(replyId), ownerUserId: 'owner', isDeleted: false };
  replies.push(reply);
  return {
    _id: new mongoose.Types.ObjectId(commentId),
    postId: new mongoose.Types.ObjectId(postId),
    ownerUserId: 'owner',
    replies,
    save: async () => {},
  };
}

test('only admins can choose official comments and replies, without forcing their choice', async (t) => {
  const created = [];
  const eventList = captureEvents(t);
  mockCommentCountSync();
  mock.method(Post, 'findOne', async () => ({ ownerUserId: 'owner', title: '帖子' }));
  mock.method(Post, 'exists', async () => true);
  mock.method(Comment, 'create', async (data) => {
    created.push(data);
    const comment = { ...data, _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
    return { _id: comment._id, toObject: () => comment };
  });

  const response = () => ({
    status(_code) { return this; },
    json(value) { this.body = value; return this; },
  });
  await commentController.create({
    body: { postId, content: '普通评论', official: true },
    user: { _id: 'owner', role: 'user' },
  }, response());
  await commentController.create({
    body: { postId, content: '管理员普通评论', official: false },
    user: { _id: 'owner', role: 'admin' },
  }, response());
  await commentController.create({
    body: { postId, content: '官方评论', official: true },
    user: { _id: 'owner', role: 'admin' },
  }, response());
  await commentController.create({
    body: { postId, content: '管理员未选择官方身份' },
    user: { _id: 'owner', role: 'admin' },
  }, response());

  const replyComments = [];
  mock.method(Comment, 'findOne', async () => {
    const replies = [];
    replies.id = () => null;
    replies.push = (data) => Array.prototype.push.call(replies, {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
    });
    const comment = {
      _id: new mongoose.Types.ObjectId(commentId),
      postId: new mongoose.Types.ObjectId(postId),
      replies,
      save: async () => {},
    };
    replyComments.push(comment);
    return comment;
  });
  await commentController.reply({
    params: { commentId },
    body: { content: '普通回复', official: true },
    user: { _id: 'owner', role: 'user' },
  }, response());
  await commentController.reply({
    params: { commentId },
    body: { content: '管理员普通回复', official: false },
    user: { _id: 'owner', role: 'admin' },
  }, response());
  await commentController.reply({
    params: { commentId },
    body: { content: '官方回复', official: true },
    user: { _id: 'owner', role: 'admin' },
  }, response());
  await commentController.reply({
    params: { commentId },
    body: { content: '管理员未选择官方身份' },
    user: { _id: 'owner', role: 'admin' },
  }, response());

  assert.deepEqual(created.map((comment) => comment.official), [false, false, true, false]);
  assert.deepEqual(replyComments.map((comment) => comment.replies[0].official), [false, false, true, false]);
  assert.equal(eventList().filter(({ event }) => event === 'comment-created').length, 4);
  assert.equal(eventList().filter(({ event }) => event === 'reply-created').length, 4);
});

test('public comment reads and writes reject a deleted parent post', async () => {
  mock.method(Post, 'exists', async () => null);
  mock.method(Post, 'findOne', async () => null);
  mock.method(Comment, 'findOne', async () => makeCommentWithReply());
  const commentFind = mock.method(Comment, 'find', () => {
    throw new Error('Comment.find should not be reached');
  });
  const commentCreate = mock.method(Comment, 'create', async () => {
    throw new Error('Comment.create should not be reached');
  });

  for (const operation of [
    () => getComments(postId),
    () => createComment('user', postId, '正文'),
    () => addReply('user', commentId, '正文'),
    () => deleteComment('owner', commentId),
    () => deleteReply('owner', commentId, replyId),
  ]) {
    await assert.rejects(operation, { errorCode: 'POST_NOT_FOUND' });
  }

  assert.equal(commentFind.mock.callCount(), 0);
  assert.equal(commentCreate.mock.callCount(), 0);
});

test('comment and reply likes reject a deleted parent before changing like state', async () => {
  mock.method(Comment, 'findOne', () => ({
    select: () => ({ lean: async () => ({ postId: new mongoose.Types.ObjectId(postId) }) }),
  }));
  mock.method(Post, 'exists', async () => null);
  const likeUpdate = mock.method(Comment, 'findOneAndUpdate', async () => {
    throw new Error('Like update should not be reached');
  });

  await assert.rejects(() => toggleLike('user', commentId), { errorCode: 'POST_NOT_FOUND' });
  await assert.rejects(() => toggleReplyLike('user', commentId, replyId), { errorCode: 'POST_NOT_FOUND' });
  assert.equal(likeUpdate.mock.callCount(), 0);
});
