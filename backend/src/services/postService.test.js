import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import Post from '../models/Post.js';
import { getPosts } from './postService.js';

afterEach(() => mock.restoreAll());

function captureFeedQuery() {
  const filters = [];
  mock.method(Post, 'find', (filter) => {
    filters.push(filter);
    return { sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
  });
  mock.method(Post, 'countDocuments', async (filter) => {
    filters.push(filter);
    return 0;
  });
  return filters;
}

test('exact tag filtering is applied to both rows and total alongside keyword search', async () => {
  const filters = captureFeedQuery();
  await getPosts({ query: '图书馆', tag: ' 校园生活 ' });
  assert.equal(filters.length, 2);
  for (const filter of filters) {
    assert.equal(filter.isDeleted, false);
    assert.equal(filter.tags, '校园生活');
    assert.equal(filter.$or[0].title.test('图书馆自习'), true);
    assert.equal(filter.$or[0].title.test('食堂'), false);
  }
});

test('keyword regex characters are literal, and invalid tag objects do not become Mongo operators', async () => {
  const filters = captureFeedQuery();
  await getPosts({ query: 'a.*', tag: { $ne: null } });
  assert.equal(filters[0].$or[0].title.test('a.*'), true);
  assert.equal(filters[0].$or[0].title.test('abcd'), false);
  assert.equal(filters[0].tags, undefined);
});
