import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Draft from '../models/Draft.js';
import Post from '../models/Post.js';
import { readImage, storeInlineImage } from './imageStorage.js';
import { addClient, removeClient } from './sseManager.js';
import { createDraft, getDrafts, getDraftById, publishDraft, updateDraft } from './draftService.js';

afterEach(() => mock.restoreAll());

async function useTempImageStorage(t) {
  const previousDirectory = process.env.IMAGE_STORAGE_DIR;
  const directory = await mkdtemp(join(tmpdir(), 'treehole-draft-images-'));
  process.env.IMAGE_STORAGE_DIR = directory;
  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.IMAGE_STORAGE_DIR;
    else process.env.IMAGE_STORAGE_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  });
}

function captureEvents(t) {
  const writes = [];
  const userId = `draft-service-test-${Math.random()}`;
  const client = addClient(userId, { write: (payload) => writes.push(payload) });
  t.after(() => removeClient(userId, client));
  return () => writes.map((payload) => {
    const [, event] = payload.match(/^event: ([^\n]+)/);
    const [, data] = payload.match(/\ndata: (.+)\n\n$/);
    return { event, data: JSON.parse(data) };
  });
}

function makeDraft() {
  return {
    _id: 'draft-1',
    title: '标题',
    content: '正文',
    moodType: 'calm',
    mood: '平静',
    tags: ['树洞'],
    images: [],
  };
}

test('draft listing projects only summary fields and omits inline image payloads', async () => {
  const image = `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`;
  const draft = {
    ...makeDraft(), ownerUserId: 'user-1', image, images: [image],
    updatedAt: new Date('2026-10-26T00:00:00Z'),
  };
  let filter;
  let projection;
  let sort;
  mock.method(Draft, 'find', (value) => {
    filter = value;
    return {
      select(fields) { projection = fields; return this; },
      sort(order) { sort = order; return this; },
      lean: async () => [draft],
    };
  });

  const summaries = await getDrafts('user-1');

  assert.deepEqual(filter, { ownerUserId: 'user-1' });
  assert.equal(projection, 'title content tags updatedAt');
  assert.deepEqual(sort, { updatedAt: -1 });
  assert.deepEqual(summaries, [{
    id: 'draft-1', title: '标题', content: '正文', tags: ['树洞'], updatedAt: draft.updatedAt,
  }]);
  assert.ok(Buffer.byteLength(JSON.stringify(summaries)) < 1024);
});

test('opening a draft retains every image including legacy single-image drafts', async () => {
  const images = ['data:image/png;base64,AA==', 'data:image/jpeg;base64,AQ=='];
  let filter;
  let draft = { ...makeDraft(), images };
  mock.method(Draft, 'findOne', (value) => {
    filter = value;
    return { lean: async () => draft };
  });

  const detail = await getDraftById('draft-1', 'user-1');
  assert.deepEqual(filter, { _id: 'draft-1', ownerUserId: 'user-1' });
  assert.equal(detail.images.length, images.length);
  assert.ok(detail.images.every((image) => image.startsWith('/api/media/drafts/draft-1/')));
  assert.equal(detail.image, detail.images[0]);
  assert.deepEqual(detail.imageBytes, images.map((image) => Buffer.byteLength(image, 'utf8')));
  assert.equal(JSON.stringify(detail).includes('data:image/'), false);
  assert.equal(JSON.stringify(detail).includes('file:'), false);

  draft = { ...makeDraft(), image: images[1], images: [] };
  const legacyDetail = await getDraftById('draft-1', 'user-1');
  assert.equal(legacyDetail.images.length, 1);
  assert.ok(legacyDetail.images[0].startsWith('/api/media/drafts/draft-1/'));
  assert.equal(legacyDetail.image, legacyDetail.images[0]);
  assert.deepEqual(legacyDetail.imageBytes, [Buffer.byteLength(images[1], 'utf8')]);
});

test('creating a draft stores submitted images and returns same-origin URLs with encoded sizes', async (t) => {
  await useTempImageStorage(t);
  const image = 'data:image/png;base64,AA==';
  let createdData;
  mock.method(Draft, 'countDocuments', async () => 0);
  mock.method(Draft, 'create', async (data) => {
    createdData = data;
    const draft = { ...data, _id: 'draft-1', updatedAt: new Date() };
    return { toObject: () => draft };
  });

  const draft = await createDraft('user-1', { content: '草稿正文', images: [image] });

  assert.match(createdData.images[0], /^file:[a-f0-9]{64}\.png$/);
  assert.deepEqual((await readImage(createdData.images[0])).buffer, Buffer.from('AA==', 'base64'));
  assert.match(draft.images[0], /^\/api\/media\/drafts\/draft-1\/0\?v=/);
  assert.equal(draft.image, draft.images[0]);
  assert.deepEqual(draft.imageBytes, [Buffer.byteLength(image, 'utf8')]);
  assert.equal(JSON.stringify(draft).includes('data:image/'), false);
  assert.equal(JSON.stringify(draft).includes('file:'), false);
});

test('draft updates map only this draft’s media URLs back to refs and store new inline images', async (t) => {
  await useTempImageStorage(t);
  const existingDataUrl = 'data:image/png;base64,AA==';
  const newDataUrl = 'data:image/jpeg;base64,AQ==';
  const existingRef = await storeInlineImage(existingDataUrl);
  const currentDraft = {
    ...makeDraft(),
    _id: 'draft-1',
    images: [existingRef],
    updatedAt: new Date('2026-10-25T00:00:00.000Z'),
  };
  let updatedFilter;
  let updateDocument;
  mock.method(Draft, 'findOne', () => ({ lean: async () => currentDraft }));
  mock.method(Draft, 'findOneAndUpdate', (filter, update) => {
    updatedFilter = filter;
    updateDocument = update;
    return { lean: async () => ({ ...currentDraft, ...update.$set, image: undefined }) };
  });
  const currentDto = await getDraftById('draft-1', 'user-1');

  const updated = await updateDraft('draft-1', 'user-1', {
    content: '更新后的正文',
    images: [currentDto.images[0], newDataUrl],
  });

  assert.deepEqual(updatedFilter, { _id: 'draft-1', ownerUserId: 'user-1' });
  assert.equal(updateDocument.$set.images[0], existingRef);
  assert.match(updateDocument.$set.images[1], /^file:[a-f0-9]{64}\.jpeg$/);
  assert.deepEqual(updateDocument.$unset, { image: '' });
  assert.equal(updated.content, '更新后的正文');
  assert.equal(updated.images.length, 2);
  assert.deepEqual(updated.imageBytes, [Buffer.byteLength(existingDataUrl), Buffer.byteLength(newDataUrl)]);
  assert.ok(updated.images.every((image) => image.startsWith('/api/media/drafts/draft-1/')));
  assert.equal(JSON.stringify(updated).includes('file:'), false);
  assert.equal(JSON.stringify(updated).includes('data:image/'), false);
});

test('reordering and removing draft image URLs preserves the selected image bytes', async (t) => {
  await useTempImageStorage(t);
  const first = await storeInlineImage('data:image/png;base64,AA==');
  const second = await storeInlineImage('data:image/png;base64,AQ==');
  let current = { ...makeDraft(), images: [first, second] };
  mock.method(Draft, 'findOne', () => ({ lean: async () => current }));
  mock.method(Draft, 'findOneAndUpdate', (_filter, update) => ({
    lean: async () => { current = { ...current, ...update.$set }; return current; },
  }));
  const original = await getDraftById('draft-1', 'user-1');
  const reordered = await updateDraft('draft-1', 'user-1', {
    content: '调整图片顺序', images: [original.images[1], original.images[0]],
  });
  assert.deepEqual(current.images, [second, first]);
  assert.deepEqual((await readImage(current.images[0])).buffer, Buffer.from([1]));
  const removed = await updateDraft('draft-1', 'user-1', { content: '保留原第一张', images: [reordered.images[1]] });
  assert.deepEqual(current.images, [first]);
  assert.deepEqual(removed.images, [original.images[0]]);
});

test('legacy inline draft images remain editable through their serialized media URLs', async (t) => {
  await useTempImageStorage(t);
  const legacyImage = 'data:image/png;base64,AA==';
  const currentDraft = {
    ...makeDraft(),
    _id: 'legacy-draft',
    images: [legacyImage],
    updatedAt: new Date('2026-10-25T00:00:00.000Z'),
  };
  let updateDocument;
  mock.method(Draft, 'findOne', () => ({ lean: async () => currentDraft }));
  mock.method(Draft, 'findOneAndUpdate', (_filter, update) => {
    updateDocument = update;
    return { lean: async () => ({ ...currentDraft, ...update.$set }) };
  });
  const currentDto = await getDraftById('legacy-draft', 'user-1');

  const updated = await updateDraft('legacy-draft', 'user-1', {
    content: '仍可编辑',
    images: currentDto.images,
  });

  assert.match(updateDocument.$set.images[0], /^file:[a-f0-9]{64}\.png$/);
  assert.match(updated.images[0], /^\/api\/media\/drafts\/legacy-draft\/0\?v=/);
  assert.deepEqual(updated.imageBytes, [Buffer.byteLength(legacyImage)]);
  assert.equal(JSON.stringify(updated).includes('data:image/'), false);
});

test('draft updates reject direct internal refs and media URLs from other content', async (t) => {
  await useTempImageStorage(t);
  const currentDraft = { ...makeDraft(), _id: 'draft-1', images: ['data:image/png;base64,AA=='] };
  mock.method(Draft, 'findOne', () => ({ lean: async () => currentDraft }));
  const update = mock.method(Draft, 'findOneAndUpdate', () => {
    throw new Error('Draft.findOneAndUpdate must not be reached');
  });

  await assert.rejects(
    () => updateDraft('draft-1', 'user-1', { content: '正文', images: ['file:' + 'a'.repeat(64) + '.png'] }),
    { errorCode: 'INVALID_IMAGE' },
  );
  await assert.rejects(
    () => updateDraft('draft-1', 'user-1', { content: '正文', images: ['/api/media/drafts/another-draft/0?v=x'] }),
    { errorCode: 'INVALID_IMAGE' },
  );
  assert.equal(update.mock.callCount(), 0);
});

test('publishing a draft emits the new-post event', async (t) => {
  const events = captureEvents(t);
  mock.method(Draft, 'findOne', async () => makeDraft());
  mock.method(Draft, 'deleteOne', async () => ({ deletedCount: 1 }));
  mock.method(Post, 'create', async (data) => {
    const post = {
      ...data,
      _id: 'published-post',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      images: [],
    };
    return { ...post, toObject: () => post };
  });

  const post = await publishDraft('draft-1', 'user-1');

  assert.equal(post.id, 'published-post');
  assert.deepEqual(events(), [{ event: 'new-post', data: {} }]);
});

test('an editor opened before image migration can save its unchanged image URL afterwards', async (t) => {
  await useTempImageStorage(t);
  const image = 'data:image/png;base64,AA==';
  let draft = { ...makeDraft(), images: [image] };
  mock.method(Draft, 'findOne', () => ({ lean: async () => draft }));
  mock.method(Draft, 'findOneAndUpdate', (_filter, update) => ({
    lean: async () => ({ ...draft, ...update.$set }),
  }));
  const opened = await getDraftById('draft-1', 'user-1');
  draft = { ...draft, images: [await storeInlineImage(image)] };
  const saved = await updateDraft('draft-1', 'user-1', { content: '迁移之后继续编辑', images: opened.images });
  assert.deepEqual(saved.images, opened.images);
  assert.equal(saved.content, '迁移之后继续编辑');
});

test('publishing a legacy base64 draft stores the image and returns a post media URL', async (t) => {
  await useTempImageStorage(t);
  const events = captureEvents(t);
  const image = 'data:image/png;base64,AA==';
  let createdPost;
  mock.method(Draft, 'findOne', async () => ({ ...makeDraft(), images: [image] }));
  mock.method(Draft, 'deleteOne', async () => ({ deletedCount: 1 }));
  mock.method(Post, 'create', async (data) => {
    createdPost = data;
    const post = {
      ...data,
      _id: 'published-post',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      images: data.images,
    };
    return { ...post, toObject: () => post };
  });

  const post = await publishDraft('draft-1', 'user-1');

  assert.match(createdPost.images[0], /^file:[a-f0-9]{64}\.png$/);
  assert.match(post.images[0], /^\/api\/media\/posts\/published-post\/0\?v=/);
  assert.equal(post.image, post.images[0]);
  assert.equal(JSON.stringify(post).includes('data:image/'), false);
  assert.equal(JSON.stringify(post).includes('file:'), false);
  assert.deepEqual(events(), [{ event: 'new-post', data: {} }]);
});

test('a failed post creation emits no new-post event', async (t) => {
  const events = captureEvents(t);
  mock.method(Draft, 'findOne', async () => makeDraft());
  mock.method(Post, 'create', async () => {
    throw new Error('database write failed');
  });
  const draftDelete = mock.method(Draft, 'deleteOne', async () => ({ deletedCount: 1 }));

  await assert.rejects(() => publishDraft('draft-1', 'user-1'), /database write failed/);

  assert.equal(draftDelete.mock.callCount(), 0);
  assert.deepEqual(events(), []);
});
