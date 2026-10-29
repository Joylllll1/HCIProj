import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import { readImage } from './imageStorage.js';
import { createPost, getPostById, getPosts } from './postService.js';

afterEach(() => mock.restoreAll());

async function useTempImageStorage(t) {
  const previousDirectory = process.env.IMAGE_STORAGE_DIR;
  const directory = await mkdtemp(join(tmpdir(), 'treehole-post-images-'));
  process.env.IMAGE_STORAGE_DIR = directory;
  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.IMAGE_STORAGE_DIR;
    else process.env.IMAGE_STORAGE_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  });
}

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

test('createPost ignores client-supplied state and stores images outside MongoDB', async (t) => {
  await useTempImageStorage(t);
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
    images: [getCreatedPost().images[0]],
  });
  assert.match(getCreatedPost().images[0], /^file:[a-f0-9]{64}\.png$/);
  assert.deepEqual((await readImage(getCreatedPost().images[0])).buffer, Buffer.from('AA==', 'base64'));
  assert.match(post.images[0], /^\/api\/media\/posts\/post-1\/0\?v=/);
  assert.equal(JSON.stringify(post).includes('data:image/'), false);
  assert.equal(JSON.stringify(post).includes('file:'), false);
  assert.equal(post.ownerUserId, 'authenticated-user');
  assert.equal(post.isDeleted, false);
  assert.equal(post.likes, 0);
  assert.equal(post.saves, 0);
  assert.equal(post.comments, 0);
  assert.equal(post.isLiked, false);
  assert.equal(post.isSaved, false);
});

test('createPost keeps supported fields and accepts an image-only post', async (t) => {
  await useTempImageStorage(t);
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
    images: [getCreatedPost().images[0]],
  });
  assert.match(post.images[0], /^\/api\/media\/posts\/post-1\/0\?v=/);
  assert.equal(post.image, post.images[0]);
  assert.equal(post.content, '');
});

test('legacy post image data is serialized as a same-origin media URL when read', async () => {
  const postId = new mongoose.Types.ObjectId();
  mock.method(Post, 'findOne', () => ({
    lean: async () => ({
      _id: postId,
      title: '旧帖子',
      content: '正文',
      image: 'data:image/jpeg;base64,AQ==',
      images: [],
      likedBy: [],
      savedBy: [],
      likes: 0,
      saves: 0,
      comments: 0,
    }),
  }));
  mock.method(Comment, 'aggregate', async () => []);

  const post = await getPostById(postId.toString(), 'user-1');

  assert.match(post.image, new RegExp(`^/api/media/posts/${postId}/0\\?v=`));
  assert.deepEqual(post.images, [post.image]);
  assert.equal(JSON.stringify(post).includes('data:image/'), false);
  assert.equal(JSON.stringify(post).includes('file:'), false);
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
