import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {
  getImageEncodedBytes,
  isStoredImageRef,
  readImage,
  storeInlineImage,
  storeInlineImages,
  storeTrustedImages,
} from './imageStorage.js';

let originalStorageDir;
let tempStorageDir;

beforeEach(async () => {
  originalStorageDir = process.env.IMAGE_STORAGE_DIR;
  tempStorageDir = await mkdtemp(path.join(os.tmpdir(), 'treehole-image-storage-'));
  process.env.IMAGE_STORAGE_DIR = tempStorageDir;
});

afterEach(async () => {
  if (originalStorageDir === undefined) delete process.env.IMAGE_STORAGE_DIR;
  else process.env.IMAGE_STORAGE_DIR = originalStorageDir;
  await rm(tempStorageDir, { recursive: true, force: true });
});

test('stores content-addressed files once and reads both stored and legacy data URLs', async () => {
  const source = Buffer.from('small png payload');
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  const firstRef = await storeInlineImage(dataUrl, '帖子图片');
  const secondRef = await storeInlineImage(dataUrl, '帖子图片');

  assert.match(firstRef, /^file:[a-f\d]{64}\.png$/);
  assert.equal(secondRef, firstRef);
  assert.equal(isStoredImageRef(firstRef), true);
  assert.deepEqual(await readdir(tempStorageDir), [`${firstRef.slice(5)}`]);
  assert.deepEqual(await readFile(path.join(tempStorageDir, firstRef.slice(5))), source);

  const storedImage = await readImage(firstRef);
  assert.deepEqual(storedImage.buffer, source);
  assert.equal(storedImage.contentType, 'image/png');
  assert.match(storedImage.etag, /^"[a-f\d]{64}"$/);
  assert.deepEqual((await readImage(dataUrl)).buffer, source);
  assert.equal(await getImageEncodedBytes(firstRef), Buffer.byteLength(dataUrl, 'utf8'));
});

test('concurrent identical writes only publish complete final bytes', async () => {
  const source = Buffer.alloc(2 * 1024 * 1024, 42);
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  const refs = await Promise.all(
    Array.from({ length: 8 }, () => storeInlineImage(dataUrl)),
  );

  assert.equal(new Set(refs).size, 1);
  const ref = refs[0];
  assert.deepEqual((await readImage(ref)).buffer, source);
  assert.deepEqual(await readdir(tempStorageDir), [ref.slice(5)]);
});

test('new-client storage rejects internal refs and applies image collection limits', async () => {
  const ref = await storeInlineImage('data:image/png;base64,AA==');

  await assert.rejects(() => storeInlineImage(ref), { errorCode: 'INVALID_IMAGE' });
  await assert.rejects(
    () => storeInlineImages(['data:image/png;base64,AA==', 'data:image/png;base64,AQ=='], {
      label: '帖子图片',
      maxCount: 1,
    }),
    { errorCode: 'IMAGE_LIMIT_EXCEEDED' },
  );
  await assert.rejects(
    () => storeTrustedImages(['data:image/png;base64,AA==', 'data:image/png;base64,AQ=='], {
      label: '草稿图片',
      maxTotalBytes: 1,
    }),
    { errorCode: 'IMAGE_TOTAL_TOO_LARGE' },
  );

  const retained = await storeTrustedImages([ref, 'data:image/gif;base64,AQ==']);
  assert.equal(retained[0], ref);
  assert.match(retained[1], /^file:[a-f\d]{64}\.gif$/);
});

test('trusted stored refs still enforce the single-image encoded-size limit', async () => {
  const source = Buffer.alloc(2_500_000, 7);
  const digest = createHash('sha256').update(source).digest('hex');
  const ref = `file:${digest}.png`;
  await writeFile(path.join(tempStorageDir, `${digest}.png`), source);

  await assert.rejects(() => storeTrustedImages([ref]), { errorCode: 'IMAGE_TOO_LARGE' });
});

test('a missing stored file returns a safe 404 without exposing its path', async () => {
  const ref = `file:${'a'.repeat(64)}.png`;
  await assert.rejects(() => readImage(ref), (error) => {
    assert.equal(error.statusCode, 404);
    assert.equal(error.errorCode, 'IMAGE_NOT_FOUND');
    assert.equal(error.message.includes(tempStorageDir), false);
    return true;
  });
});

test('a failed directory setup does not leave a readable final ref or temporary file', async () => {
  const blocker = path.join(tempStorageDir, 'not-a-directory');
  await writeFile(blocker, 'file blocks storage directory creation');
  process.env.IMAGE_STORAGE_DIR = path.join(blocker, 'images');
  const source = Buffer.from('write failure');
  const dataUrl = `data:image/gif;base64,${source.toString('base64')}`;
  const digest = createHash('sha256').update(source).digest('hex');
  const ref = `file:${digest}.gif`;

  await assert.rejects(() => storeInlineImage(dataUrl));
  await assert.rejects(() => readImage(ref), { errorCode: 'IMAGE_NOT_FOUND' });
  assert.deepEqual(await readdir(tempStorageDir), ['not-a-directory']);
});
