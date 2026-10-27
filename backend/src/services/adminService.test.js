import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Report from '../models/Report.js';
import { addClient, removeClient } from './sseManager.js';
import { createReport, deleteComment } from './adminService.js';

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
    { event: 'post-stats-updated', data: { postId, comments: 0 } },
    { event: 'comment-deleted', data: { postId, commentId, deletedReplyCount: 1 } },
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
    { event: 'post-stats-updated', data: { postId, comments: 0 } },
    { event: 'reply-deleted', data: { postId, commentId, replyId } },
  ]);
});

test('failed admin deletion emits no deletion events', async (t) => {
  const events = captureEvents(t);
  mock.method(Comment, 'findOne', async () => null);

  await assert.rejects(() => deleteComment(commentId, 'admin', '原因'), { errorCode: 'COMMENT_NOT_FOUND' });
  assert.deepEqual(events(), []);
});
