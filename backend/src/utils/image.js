import AppError from './AppError.js';

export const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_INLINE_IMAGE_COUNT = 9;
export const MAX_INLINE_IMAGES_TOTAL_BYTES = 8 * 1024 * 1024;

const INLINE_IMAGE_DATA_URL_RE = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i;

export function normalizeInlineImage(image, label = '图片') {
  if (image === undefined || image === null) {
    return '';
  }

  if (typeof image !== 'string') {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_IMAGE');
  }

  const trimmed = image.trim();
  if (!trimmed) {
    return '';
  }

  if (!INLINE_IMAGE_DATA_URL_RE.test(trimmed)) {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_IMAGE');
  }

  if (Buffer.byteLength(trimmed, 'utf8') > MAX_INLINE_IMAGE_BYTES) {
    throw new AppError(`${label}过大，请上传 3MB 以内图片`, 400, 'IMAGE_TOO_LARGE');
  }

  return trimmed;
}

export function normalizeInlineImages(images, options = {}) {
  const {
    label = '图片',
    maxCount = MAX_INLINE_IMAGE_COUNT,
    maxTotalBytes = MAX_INLINE_IMAGES_TOTAL_BYTES,
  } = options;

  if (!Array.isArray(images)) {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_IMAGE');
  }

  const normalizedImages = images
    .map((image) => normalizeInlineImage(image, label))
    .filter(Boolean);

  if (normalizedImages.length > maxCount) {
    throw new AppError(`${label}最多上传 ${maxCount} 张`, 400, 'IMAGE_LIMIT_EXCEEDED');
  }

  const totalBytes = normalizedImages.reduce(
    (sum, image) => sum + Buffer.byteLength(image, 'utf8'),
    0,
  );

  if (totalBytes > maxTotalBytes) {
    throw new AppError(
      `${label}总大小过大，请控制在 ${Math.floor(maxTotalBytes / (1024 * 1024))}MB 以内`,
      400,
      'IMAGE_TOTAL_TOO_LARGE',
    );
  }

  return normalizedImages;
}
