import 'express-async-errors';
import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Post from '../models/Post.js';
import errorHandler from '../middlewares/errorHandler.js';
import mediaRoutes from '../routes/mediaRoutes.js';

const postId = '507f1f77bcf86cd799439011';

afterEach(() => mock.restoreAll());

test('HTTP media route sends binary with private cache headers and checks permission before 304', async (t) => {
  let post = { images: ['data:image/png;base64,AA=='] };
  mock.method(Post, 'findOne', () => ({ lean: async () => post }));

  const app = express();
  app.use((_req, res, next) => { res.vary('Origin'); next(); });
  app.use('/api/media', mediaRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const url = `http://127.0.0.1:${server.address().port}/api/media/posts/${postId}/0?v=version`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0]));
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('etag'), /^"[a-f\d]{64}"$/);
  assert.match(response.headers.get('cache-control'), /private/);
  assert.match(response.headers.get('cache-control'), /max-age=300/);
  assert.deepEqual(response.headers.get('vary').split(/,\s*/).sort(), ['Cookie', 'Origin']);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);

  const etag = response.headers.get('etag');
  const notModified = await fetch(url, { headers: { 'If-None-Match': etag } });
  assert.equal(notModified.status, 304);

  post = null;
  const deletedResource = await fetch(url, { headers: { 'If-None-Match': etag } });
  assert.equal(deletedResource.status, 404);
  const errorBody = await deletedResource.text();
  assert.equal(errorBody.includes('/Users/'), false);
});
