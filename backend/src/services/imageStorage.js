import { createHash, randomBytes } from 'node:crypto';
import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../utils/AppError.js';
import {
  MAX_INLINE_IMAGE_BYTES,
  MAX_INLINE_IMAGE_COUNT,
  MAX_INLINE_IMAGES_TOTAL_BYTES,
  normalizeInlineImage,
  normalizeInlineImages,
} from '../utils/image.js';

const DATA_URL_RE = /^data:(image\/[a-z0-9][a-z0-9.+-]*);base64,([a-z0-9+/=\s]+)$/i;
const STORED_IMAGE_RE = /^file:([a-f0-9]{64})\.([a-z0-9][a-z0-9.+-]{0,127})$/;
const DEFAULT_STORAGE_DIR = fileURLToPath(new URL('../../storage/images/', import.meta.url));

function storageDirectory() {
  const configured = process.env.IMAGE_STORAGE_DIR;
  return configured ? path.resolve(configured) : DEFAULT_STORAGE_DIR;
}

function imageError(message = '图片不存在') {
  return new AppError(message, 404, 'IMAGE_NOT_FOUND');
}

function storedImageParts(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(STORED_IMAGE_RE);
  return match ? { digest: match[1], extension: match[2] } : null;
}

export function isStoredImageRef(value) {
  return storedImageParts(value) !== null;
}

function parseDataUrl(value, label = '图片') {
  const normalized = normalizeInlineImage(value, label);
  const match = normalized.match(DATA_URL_RE);
  if (!match) {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_IMAGE');
  }

  return {
    normalized,
    contentType: match[1].toLowerCase(),
    encoded: match[2].replace(/\s/g, ''),
  };
}

function bytesFromDataUrl(value, label) {
  const parsed = parseDataUrl(value, label);
  return {
    ...parsed,
    buffer: Buffer.from(parsed.encoded, 'base64'),
  };
}

function refFor(digest, contentType) {
  const extension = contentType.slice('image/'.length);
  return `file:${digest}.${extension}`;
}

function pathForRef(ref) {
  const parts = storedImageParts(ref);
  if (!parts) throw imageError();
  return path.join(storageDirectory(), `${parts.digest}.${parts.extension}`);
}

async function writeDataUrl(value, label) {
  const { buffer, contentType } = bytesFromDataUrl(value, label);
  const digest = createHash('sha256').update(buffer).digest('hex');
  const ref = refFor(digest, contentType);
  const directory = storageDirectory();
  const filePath = path.join(directory, `${digest}.${contentType.slice('image/'.length)}`);
  const temporaryPath = path.join(
    directory,
    `.${digest}.${randomBytes(12).toString('hex')}.tmp`,
  );

  await mkdir(directory, { recursive: true });
  try {
    // Finish writing a unique temp file before atomically linking it into its
    // content-addressed name. A competing writer can only observe a complete
    // file, while an existing file is never overwritten.
    await writeFile(temporaryPath, buffer, { flag: 'wx' });
    try {
      await link(temporaryPath, filePath);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = await readFile(filePath);
      const existingDigest = createHash('sha256').update(existing).digest('hex');
      if (existingDigest !== digest) throw imageError('图片存储异常');
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }

  return ref;
}

export async function storeInlineImage(value, label = '图片') {
  const normalized = normalizeInlineImage(value, label);
  if (!normalized) return '';
  return writeDataUrl(normalized, label);
}

export async function storeInlineImages(values, options = {}) {
  const normalized = normalizeInlineImages(values, options);
  return Promise.all(normalized.map((value) => writeDataUrl(value, options.label || '图片')));
}

async function encodedSizeForStoredRef(ref) {
  const parts = storedImageParts(ref);
  if (!parts) throw new AppError('图片引用无效', 400, 'INVALID_IMAGE');

  try {
    const fileStats = await stat(pathForRef(ref));
    if (!fileStats.isFile()) throw imageError();
    const encodedLength = 4 * Math.ceil(fileStats.size / 3);
    return Buffer.byteLength(`data:image/${parts.extension};base64,`, 'utf8') + encodedLength;
  } catch (error) {
    if (error.code === 'ENOENT' || error.errorCode === 'IMAGE_NOT_FOUND') throw imageError();
    throw error;
  }
}

export async function getImageEncodedBytes(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (isStoredImageRef(value)) return encodedSizeForStoredRef(value);
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    const normalized = normalizeInlineImage(value);
    return Buffer.byteLength(normalized, 'utf8');
  }
  throw new AppError('图片格式无效', 400, 'INVALID_IMAGE');
}

function validateImageCollectionLimits(values, options, encodedSizes) {
  const {
    label = '图片',
    maxCount = MAX_INLINE_IMAGE_COUNT,
    maxTotalBytes = MAX_INLINE_IMAGES_TOTAL_BYTES,
  } = options;

  if (values.length > maxCount) {
    throw new AppError(`${label}最多上传 ${maxCount} 张`, 400, 'IMAGE_LIMIT_EXCEEDED');
  }

  if (encodedSizes.some((size) => size > MAX_INLINE_IMAGE_BYTES)) {
    throw new AppError(`${label}过大，请上传 3MB 以内图片`, 400, 'IMAGE_TOO_LARGE');
  }

  const totalBytes = encodedSizes.reduce((sum, size) => sum + size, 0);
  if (totalBytes > maxTotalBytes) {
    throw new AppError(
      `${label}总大小过大，请控制在 ${Math.floor(maxTotalBytes / (1024 * 1024))}MB 以内`,
      400,
      'IMAGE_TOTAL_TOO_LARGE',
    );
  }
}

export async function storeTrustedImages(values, options = {}) {
  const label = options.label || '图片';
  if (!Array.isArray(values)) {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_IMAGE');
  }

  const normalized = [];
  for (const value of values) {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      continue;
    }
    if (isStoredImageRef(value)) {
      normalized.push(value);
      continue;
    }
    normalized.push(normalizeInlineImage(value, label));
  }

  const encodedSizes = await Promise.all(normalized.map((value) => getImageEncodedBytes(value)));
  validateImageCollectionLimits(normalized, options, encodedSizes);

  return Promise.all(normalized.map((value) => (
    isStoredImageRef(value) ? value : writeDataUrl(value, label)
  )));
}

export async function readImage(value) {
  let buffer;
  let contentType;
  let expectedDigest = null;

  if (isStoredImageRef(value)) {
    const parts = storedImageParts(value);
    expectedDigest = parts.digest;
    contentType = `image/${parts.extension}`;
    try {
      buffer = await readFile(pathForRef(value));
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw imageError();
      throw error;
    }
  } else if (typeof value === 'string' && value.startsWith('data:image/')) {
    try {
      ({ buffer, contentType } = bytesFromDataUrl(value));
    } catch {
      throw imageError();
    }
  } else {
    throw imageError();
  }

  const digest = createHash('sha256').update(buffer).digest('hex');
  if (expectedDigest && digest !== expectedDigest) throw imageError();

  return {
    buffer,
    contentType,
    etag: `"${digest}"`,
  };
}

export { MAX_INLINE_IMAGE_BYTES, MAX_INLINE_IMAGE_COUNT, MAX_INLINE_IMAGES_TOTAL_BYTES };
