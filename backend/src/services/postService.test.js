import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import Post from '../models/Post.js';
import { createPost, getPosts } from './postService.js';

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

function mockPostCreate() {
  let createdPost;
  mock.method(Post, 'create', async (data) => {
    createdPost = data;
    return {
      toObject: () => ({
        ...data,
        _id: { toString: () => 'post-1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        likes: 0,
        likedBy: [],
        saves: 0,
        savedBy: [],
        comments: 0,
        isDeleted: false,
      }),
    };
  });
  return () => createdPost;
}

test('createPost ignores client-supplied state and preserves supported fields', async () => {
  const getCreatedPost = mockPostCreate();
  const image = 'data:image/png;base64,AA==';
  const post = await createPost('authenticated-user', {
    ownerUserId: 'attacker-user',
    title: '  保留的标题  ',
    content: '  正文  ',
    tags: [' 校园生活 '],
    mood: '开心',
    moodType: 'happy',
    images: [image],
    isDeleted: true,
    likedBy: ['attacker-user'],
    likes: 999,
    savedBy: ['attacker-user'],
    saves: 999,
    comments: 999,
    campus: '鼓楼',
    _id: 'attacker-post',
  });

  assert.deepEqual(getCreatedPost(), {
    ownerUserId: 'authenticated-user',
    title: '保留的标题',
    content: '正文',
    moodType: 'happy',
    mood: '开心',
    campus: '鼓楼',
    tags: ['校园生活'],
    images: [image],
  });
  assert.equal(post.ownerUserId, 'authenticated-user');
  assert.equal(post.isDeleted, false);
  assert.equal(post.likes, 0);
  assert.equal(post.saves, 0);
  assert.equal(post.comments, 0);
  assert.equal(post.isLiked, false);
  assert.equal(post.isSaved, false);
});

test('createPost keeps supported fields and accepts an image-only post', async () => {
  const getCreatedPost = mockPostCreate();
  const image = 'data:image/png;base64,AA==';
  const post = await createPost('authenticated-user', {
    image,
    mood: '平静',
    moodType: 'calm',
  });

  assert.deepEqual(getCreatedPost(), {
    ownerUserId: 'authenticated-user',
    title: '无标题',
    content: '',
    moodType: 'calm',
    mood: '平静',
    tags: ['树洞'],
    images: [image],
  });
  assert.equal(post.image, post.images[0]);
  assert.equal(post.content, '');
});

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
