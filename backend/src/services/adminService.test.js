import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Report from '../models/Report.js';
import { addClient, removeClient } from './sseManager.js';
import { createReport, deleteComment, deletePost, getPendingReports } from './adminService.js';

const postId = '507f1f77bcf86cd799439011';
const commentId = '507f1f77bcf86cd799439012';
const replyId = '507f1f77bcf86cd799439013';

afterEach(() => mock.restoreAll());

function queryResult(value) {
  return {
    select() { return this; },
    lean: async () => value,
  };
}

function captureEvents(t) {
  const writes = [];
  const userId = `admin-service-test-${Math.random()}`;
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
  mock.method(Report, 'deleteMany', async () => ({ deletedCount: 0 }));
  mock.method(AuditLog, 'create', async () => ({}));
}

test('reports for missing targets are rejected before a report write', async () => {
  mock.method(Post, 'findOne', () => queryResult(null));
  mock.method(Comment, 'findOne', () => queryResult(null));
  const duplicateLookup = mock.method(Report, 'findOne', () => ({ lean: async () => null }));
  const reportWrite = mock.method(Report, 'findOneAndUpdate', async () => ({}));

  for (const targetType of ['post', 'comment', 'reply']) {
    await assert.rejects(
      () => createReport('missing-target', targetType, '原因', 'reporter'),
      { errorCode: 'REPORT_TARGET_NOT_FOUND' },
    );
  }

  assert.equal(duplicateLookup.mock.callCount(), 0);
  assert.equal(reportWrite.mock.callCount(), 0);
});

test('comments on a deleted post cannot enter the report queue', async () => {
  mock.method(Comment, 'findOne', () => queryResult({ postId: new mongoose.Types.ObjectId(postId) }));
  mock.method(Post, 'findOne', () => queryResult(null));
  const reportWrite = mock.method(Report, 'findOneAndUpdate', async () => ({}));

  await assert.rejects(
    () => createReport(commentId, 'comment', '原因', 'reporter'),
    { errorCode: 'REPORT_TARGET_NOT_FOUND' },
  );
  assert.equal(reportWrite.mock.callCount(), 0);
});

test('valid reports retain the existing pending-report upsert behavior', async () => {
  const captured = {};
  mock.method(Post, 'findOne', () => queryResult({ _id: new mongoose.Types.ObjectId(postId) }));
  mock.method(Report, 'findOne', () => ({ lean: async () => null }));
  mock.method(Report, 'findOneAndUpdate', async (...args) => {
    [captured.filter, captured.update, captured.options] = args;
    return { _id: 'report-1' };
  });

  const report = await createReport(postId, 'post', '原因', 'reporter');

  assert.deepEqual(report, { _id: 'report-1' });
  assert.deepEqual(captured.filter, {
    targetId: postId,
    targetType: 'post',
    status: 'pending',
    'reasons.reportedBy': { $ne: 'reporter' },
  });
  assert.equal(captured.update.$inc.reportCount, 1);
  assert.deepEqual(captured.update.$push.reasons, { reason: '原因', reportedBy: 'reporter' });
  assert.equal(captured.update.$setOnInsert.postId.toString(), postId);
  assert.equal(captured.options.upsert, true);
});

test('pending post reports serialize moderator preview images as media URLs', async () => {
  const post = {
    _id: new mongoose.Types.ObjectId(postId),
    title: '被举报帖子',
    content: '正文',
    image: 'data:image/png;base64,AA==',
    images: ['file:' + 'a'.repeat(64) + '.png'],
  };
  const populatedFields = [];
  mock.method(Report, 'find', () => {
    const query = {
      populate(...args) { populatedFields.push(args); return query; },
      sort() { return query; },
      lean: async () => [{ _id: 'report-1', targetType: 'post', targetId: post._id, postId: post }],
    };
    return query;
  });

  const [report] = await getPendingReports();

  assert.ok(populatedFields.some(([, fields]) => fields.includes('image images')));
  assert.match(report.postId.images[0], /^\/api\/media\/posts\/[a-f0-9]{24}\/0\?v=/);
  assert.equal(report.postId.image, report.postId.images[0]);
  assert.equal(JSON.stringify(report).includes('data:image/'), false);
  assert.equal(JSON.stringify(report).includes('file:'), false);
});

test('comment reports serialize their populated post preview images too', async () => {
  const post = {
    _id: new mongoose.Types.ObjectId(postId),
    title: '评论所属帖子',
    image: 'data:image/png;base64,AA==',
    images: ['data:image/png;base64,AA=='],
  };
  mock.method(Report, 'find', () => {
    const query = {
      populate: () => query,
      sort: () => query,
      lean: async () => [{ _id: 'report-2', targetType: 'comment', targetId: commentId, postId: post }],
    };
    return query;
  });
  mock.method(Comment, 'findById', () => ({
    select: () => ({ lean: async () => ({ content: '被举报评论', ownerUserId: 'owner', createdAt: new Date(), postId }) }),
  }));

  const [report] = await getPendingReports();

  assert.match(report.postId.images[0], /^\/api\/media\/posts\/[a-f0-9]{24}\/0\?v=/);
  assert.equal(JSON.stringify(report).includes('data:image/'), false);
});

test('admin post deletion responses serialize legacy image values', async () => {
  const post = {
    _id: new mongoose.Types.ObjectId(postId),
    ownerUserId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    images: ['data:image/png;base64,AA=='],
    isDeleted: false,
    save: async () => {},
  };
  mock.method(Post, 'findById', async () => post);
  mock.method(Report, 'deleteMany', async () => ({ deletedCount: 0 }));
  mock.method(AuditLog, 'create', async () => ({}));

  const result = await deletePost(postId, 'admin', '原因');

  assert.equal(result.isDeleted, true);
  assert.match(result.images[0], /^\/api\/media\/posts\/[a-f0-9]{24}\/0\?v=/);
  assert.equal(JSON.stringify(result).includes('data:image/'), false);
});

test('admin comment deletion responses serialize comment and reply image values', async () => {
  mockCommentCountSync();
  const reply = {
    _id: new mongoose.Types.ObjectId(replyId),
    ownerUserId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    image: 'data:image/jpeg;base64,AQ==',
    isDeleted: false,
  };
  const comment = {
    _id: new mongoose.Types.ObjectId(commentId),
    postId: new mongoose.Types.ObjectId(postId),
    ownerUserId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    image: 'data:image/png;base64,AA==',
    replies: [reply],
    save: async () => {},
  };
  mock.method(Comment, 'findOne', async () => comment);

  const result = await deleteComment(commentId, 'admin', '原因');

  assert.match(result.image, /^\/api\/media\/comments\/[a-f0-9]{24}\?v=/);
  assert.match(result.replies[0].image, /^\/api\/media\/replies\/[a-f0-9]{24}\/[a-f0-9]{24}\?v=/);
  assert.equal(JSON.stringify(result).includes('data:image/'), false);
});

test('admin deletion broadcasts comment removal and updated comment count', async (t) => {
  const events = captureEvents(t);
  mockCommentCountSync();
  const comment = {
    _id: new mongoose.Types.ObjectId(commentId),
    postId: new mongoose.Types.ObjectId(postId),
    ownerUserId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    replies: [{ _id: new mongoose.Types.ObjectId(replyId), isDeleted: false }],
    save: async () => {},
  };
  mock.method(Comment, 'findOne', async () => comment);

  await deleteComment(commentId, 'admin', '原因');

  assert.deepEqual(events(), [
    { event: 'comment-deleted', data: { postId, commentId, deletedReplyCount: 1 } },
    { event: 'post-stats-updated', data: { postId, comments: 0 } },
  ]);
});

test('admin deletion broadcasts reply removal', async (t) => {
  const events = captureEvents(t);
  mockCommentCountSync();
  const reply = {
    _id: new mongoose.Types.ObjectId(replyId),
    ownerUserId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    isDeleted: false,
  };
  const replies = [reply];
  replies.id = (id) => replies.find((item) => item._id.toString() === id.toString());
  const parentComment = {
    _id: new mongoose.Types.ObjectId(commentId),
    postId: new mongoose.Types.ObjectId(postId),
    replies,
    save: async () => {},
  };
  mock.method(Comment, 'findOne', async (filter) => (filter._id ? null : parentComment));

  await deleteComment(replyId, 'admin', '原因');

  assert.deepEqual(events(), [
    { event: 'reply-deleted', data: { postId, commentId, replyId } },
    { event: 'post-stats-updated', data: { postId, comments: 0 } },
  ]);
});

test('failed admin deletion emits no deletion events', async (t) => {
  const events = captureEvents(t);
  mock.method(Comment, 'findOne', async () => null);

  await assert.rejects(() => deleteComment(commentId, 'admin', '原因'), { errorCode: 'COMMENT_NOT_FOUND' });
  assert.deepEqual(events(), []);
});
