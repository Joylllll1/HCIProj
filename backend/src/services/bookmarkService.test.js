import 'express-async-errors';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import * as bookmarks from './bookmarkService.js';
import * as controller from '../controllers/bookmarkController.js';
import routes from '../routes/bookmarkRoutes.js';
import errorHandler from '../middlewares/errorHandler.js';
import { backfillBookmarkVersions } from '../scripts/backfillAiAndBookmarkVersions.js';

const integration = process.env.BOOKMARK_TEST_MONGODB_URI ? test : test.skip;
const actor = new mongoose.Types.ObjectId().toString();
const other = new mongoose.Types.ObjectId().toString();
const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId().toString());
let server;
let base;
const folders = [{ id: 'all', name: '全部', isDefault: true }, { id: 'a', name: '课程' }, { id: 'b', name: '生活' }];

before(async () => {
  if (!process.env.BOOKMARK_TEST_MONGODB_URI) return;
  // The URI must name a dedicated test database; never drop application data.
  const uri = process.env.BOOKMARK_TEST_MONGODB_URI;
  assert.match(uri, /\/bookmark_test_[a-zA-Z0-9_]+(?:\?|$)/);
  await mongoose.connect(uri);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { _id: actor }; next(); });
  // Test controller transport with a trusted test identity; actual routes tested for 401 below.
  app.post('/move-many', controller.moveMany);
  app.post('/remove-many', controller.removeMany);
  app.use('/authenticated', routes);
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (!process.env.BOOKMARK_TEST_MONGODB_URI) return;
  await User.deleteMany({});
  await Post.deleteMany({});
  await User.collection.insertMany([
    { _id: new mongoose.Types.ObjectId(actor), email: 'actor@nju.edu.cn', bookmarkVersion: 0, bookmarkFolders: folders, bookmarkFolderMap: { a: [ids[0], ids[1]], b: [ids[2]] } },
    { _id: new mongoose.Types.ObjectId(other), email: 'other@nju.edu.cn', bookmarkVersion: 0, bookmarkFolders: [{ id: 'private', name: '私有夹' }] },
  ]);
  await Post.insertMany(ids.map((id, index) => ({
    _id: id, ownerUserId: actor, title: `帖子 ${index}`, savedBy: index < 3 ? [actor, other] : [other], saves: index < 3 ? 2 : 1,
  })));
});

after(async () => {
  if (!process.env.BOOKMARK_TEST_MONGODB_URI) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('batch validation rejects malformed requests before any database access', () => {
  for (const payload of [null, {}, { postIds: [] }, { postIds: [actor], expectedVersion: -1 },
    { postIds: ['invalid'], expectedVersion: 0 }, { postIds: Array(101).fill(actor), expectedVersion: 0 },
    { postIds: [actor], expectedVersion: 0, userId: other }]) {
    assert.throws(() => bookmarks.validateBatch(payload), { errorCode: 'BOOKMARK_BATCH_INVALID' });
  }
  assert.deepEqual(bookmarks.validateBatch({ postIds: [actor, actor], expectedVersion: 0 }), [actor]);
});

integration('mixed-folder move preserves savedBy/saves, deduplicates and supports moving to all', async () => {
  const beforePosts = await Post.find().lean();
  const missing = new mongoose.Types.ObjectId().toString();
  const data = await bookmarks.moveBookmarks(actor, {
    postIds: [...ids, ids[0], missing], targetFolderId: 'b', expectedVersion: 0,
  });
  assert.deepEqual(data.results.map((item) => item.status), ['moved', 'moved', 'unchanged', 'not_saved', 'not_found']);
  assert.equal(data.summary.requested, 5);
  assert.deepEqual(data.bookmarkFolders, { b: ids.slice(0, 3) });
  assert.equal(data.bookmarks.length, 3);
  assert.deepEqual(await Post.find().lean(), beforePosts);
  const again = await bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'b', expectedVersion: data.version });
  assert.equal(again.results[0].status, 'unchanged');
  const all = await bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'all', expectedVersion: again.version });
  assert.equal(all.bookmarks.length, 3);
  assert.deepEqual(all.bookmarkFolders.b, ids.slice(1, 3));
  assert.equal(all.bookmarkFolders.all, undefined);
});

integration('concurrent stale requests conflict without side effects, including deleted/foreign folders', async () => {
  const results = await Promise.allSettled([
    bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'b', expectedVersion: 0 }),
    bookmarks.moveBookmarks(actor, { postIds: [ids[1]], targetFolderId: 'b', expectedVersion: 0 }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.find((item) => item.status === 'rejected').reason.statusCode, 409);
  const state = await bookmarks.getBookmarkState(actor);
  assert.equal(state.bookmarkFolders.a.length, 1);
  await assert.rejects(bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'private', expectedVersion: state.version }), { statusCode: 404 });
  await bookmarks.deleteBookmarkFolder(actor, 'b');
  await assert.rejects(bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'b', expectedVersion: state.version }), { statusCode: 409 });
});

integration('batch cancellation decrements once and preserves other users and original posts', async () => {
  const result = await bookmarks.removeBookmarks(actor, { postIds: ids, expectedVersion: 0 });
  assert.deepEqual(result.results.map((item) => item.status), ['removed', 'removed', 'removed', 'unchanged']);
  assert.deepEqual(result.bookmarks, []);
  assert.deepEqual(result.bookmarkFolders, {});
  assert.equal(await Post.countDocuments({ isDeleted: false }), 4);
  const posts = await Post.find().lean();
  posts.forEach((post) => {
    assert.deepEqual(post.savedBy.map(String), [other]);
    assert.equal(post.saves, 1);
  });
  await bookmarks.removeBookmarks(actor, { postIds: ids, expectedVersion: result.version });
  assert.deepEqual(await Post.find().lean(), posts);
});

integration('legacy single save, toggle, folder deletion and migration share the same writer', async () => {
  const data = await bookmarks.saveBookmark(actor, ids[0], 'b');
  assert.deepEqual(data.bookmarkFolders.a, [ids[1]]);
  assert.equal((await Post.findById(ids[0])).saves, 2);
  await bookmarks.toggleBookmark(actor, ids[0]);
  assert.equal((await Post.findById(ids[0])).saves, 1);
  await bookmarks.migrateLegacyBookmarks(actor, { bookmarks: [ids[0]], collectionFolders: folders, bookmarkFolders: { a: [ids[0]], b: [ids[0]] } });
  const migrated = await bookmarks.getBookmarkState(actor);
  assert.equal(Object.values(migrated.bookmarkFolders).flat().filter((id) => id === ids[0]).length, 1);
  await bookmarks.deleteBookmarkFolder(actor, 'a');
  assert.ok((await bookmarks.getBookmarkState(actor)).bookmarks.includes(ids[0]));
});

integration('partial Post failures and map failures return truthful recoverable results', async () => {
  const original = Post.findOneAndUpdate;
  Post.findOneAndUpdate = function (filter, ...args) {
    if (filter._id === ids[1]) return { lean: async () => { throw new Error('write failed'); } };
    return original.call(this, filter, ...args);
  };
  let partial;
  try { partial = await bookmarks.removeBookmarks(actor, { postIds: [ids[0], ids[1]], expectedVersion: 0 }); }
  finally { Post.findOneAndUpdate = original; }
  assert.deepEqual(partial.results.map((item) => item.status), ['removed', 'failed']);
  assert.ok(partial.bookmarks.includes(ids[1]));
  const originalUpdate = User.updateOne;
  User.updateOne = async () => { throw new Error('map failed'); };
  try {
    const data = await bookmarks.removeBookmarks(actor, { postIds: [ids[1]], expectedVersion: partial.version });
    assert.equal(data.reconciling, true);
    assert.equal(data.results[0].status, 'removed');
    assert.ok(!data.bookmarks.includes(ids[1]));
  } finally { User.updateOne = originalUpdate; }
  const retry = await bookmarks.removeBookmarks(actor, { postIds: [ids[1]], expectedVersion: partial.version });
  assert.equal(retry.results[0].status, 'unchanged');
  assert.equal((await Post.findById(ids[1])).saves, 1);
});

integration('raw old users require idempotent backfill and first CAS succeeds after migration', async () => {
  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(actor) }, { $unset: { bookmarkVersion: '' } });
  await assert.rejects(bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'b', expectedVersion: 0 }), { errorCode: 'BOOKMARK_MIGRATION_REQUIRED' });
  assert.equal((await backfillBookmarkVersions(User.collection)).missingBookmarkVersions, 1);
  assert.equal((await User.collection.findOne({ _id: new mongoose.Types.ObjectId(actor) })).bookmarkVersion, undefined);
  await backfillBookmarkVersions(User.collection, true);
  assert.equal((await backfillBookmarkVersions(User.collection, true)).missingBookmarkVersions, 0);
  const data = await bookmarks.moveBookmarks(actor, { postIds: [ids[0]], targetFolderId: 'b', expectedVersion: 0 });
  assert.equal(data.version, 1);
});

integration('HTTP batch validation, version errors and route authentication use real status codes', async () => {
  const send = (body) => fetch(`${base}/move-many`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ postIds: ['invalid'], targetFolderId: 'b', expectedVersion: 0 })).status, 400);
  assert.equal((await send({ postIds: [ids[0]], targetFolderId: 'b', expectedVersion: 0 })).status, 200);
  assert.equal((await send({ postIds: [ids[1]], targetFolderId: 'b', expectedVersion: 0 })).status, 409);
  assert.equal((await fetch(`${base}/authenticated/move-many`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
});


integration('a committed cancellation with a lost acknowledgement is reconciled without another decrement', async () => {
  const original = Post.findOneAndUpdate;
  Post.findOneAndUpdate = function (...args) {
    return { lean: async () => {
      await original.apply(this, args).lean();
      throw new Error('lost acknowledgement');
    } };
  };
  let result;
  try { result = await bookmarks.removeBookmarks(actor, { postIds: [ids[0]], expectedVersion: 0 }); }
  finally { Post.findOneAndUpdate = original; }
  assert.equal(result.results[0].status, 'removed');
  assert.deepEqual(result.postStates, [{ postId: ids[0], isSaved: false, saves: 1 }]);
  await bookmarks.removeBookmarks(actor, { postIds: [ids[0]], expectedVersion: result.version });
  assert.equal((await Post.findById(ids[0])).saves, 1);
});
