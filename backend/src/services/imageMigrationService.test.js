import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { migrateInlineImages } from './imageMigrationService.js';
import { isStoredImageRef, readImage } from './imageStorage.js';

const image = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
let directory;
let previousDirectory;
beforeEach(async () => {
  previousDirectory = process.env.IMAGE_STORAGE_DIR;
  directory = await mkdtemp(path.join(os.tmpdir(), 'treehole-image-migration-'));
  process.env.IMAGE_STORAGE_DIR = directory;
});
afterEach(async () => {
  if (previousDirectory === undefined) delete process.env.IMAGE_STORAGE_DIR;
  else process.env.IMAGE_STORAGE_DIR = previousDirectory;
  await rm(directory, { recursive: true, force: true });
});

function modelFor(documents, matchedCount = 1) {
  const writes = [];
  return {
    writes,
    collection: {
      find: () => (async function* () { yield* documents; })(),
      updateOne: async (filter, update) => {
        writes.push({ filter, update });
        return { matchedCount };
      },
    },
  };
}

test('migration defaults to dry run without writing image files or documents', async () => {
  const Post = modelFor([{ _id: 'post-1', image }]);
  const result = await migrateInlineImages({ models: { Post } });
  assert.deepEqual(result, { Post: { found: 1, migrated: 0, skipped: 0 } });
  assert.deepEqual(Post.writes, []);
  assert.deepEqual(await readdir(directory), []);
});

test('migration preserves bytes across posts, drafts, comments, replies and events', async () => {
  const originalReply = { _id: 'reply-1', content: '原回复', image, likes: 3 };
  const models = {
    Post: modelFor([{ _id: 'post-1', image, images: [] }]),
    Draft: modelFor([{ _id: 'draft-1', images: [image] }]),
    Comment: modelFor([{ _id: 'comment-1', image, replies: [originalReply] }]),
    Event: modelFor([{ _id: 'event-1', image }]),
  };
  const result = await migrateInlineImages({ dryRun: false, models });
  for (const [name, model] of Object.entries(models)) {
    assert.deepEqual(result[name], { found: 1, migrated: 1, skipped: 0 });
    const { filter, update } = model.writes[0];
    const refs = Object.values(update.$set).flat();
    assert.ok(refs.every(isStoredImageRef));
    for (const ref of refs) {
      assert.deepEqual((await readImage(ref)).buffer, Buffer.from(image.split(',')[1], 'base64'));
    }
    assert.equal(update.$set.updatedAt, undefined);
    if (name === 'Post' || name === 'Draft') assert.deepEqual(update.$unset, { image: '' });
    else assert.equal(filter.image, image);
  }
  assert.deepEqual(models.Comment.writes[0].filter.replies, [originalReply]);
  assert.equal(originalReply.image, image);
  assert.equal((await readdir(directory)).length, 1);
});

test('migration skips a document changed since it was read', async () => {
  const oldImages = [image];
  const Draft = modelFor([{ _id: 'draft-1', images: oldImages, image: null }], 0);
  const result = await migrateInlineImages({ dryRun: false, models: { Draft } });
  assert.deepEqual(result.Draft, { found: 1, migrated: 0, skipped: 1 });
  assert.deepEqual(Draft.writes[0].filter, { _id: 'draft-1', images: oldImages, image: null });
});
