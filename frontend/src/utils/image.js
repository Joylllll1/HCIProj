const DEFAULT_MAX_DIMENSION = 1280;
const MAX_LONG_DIMENSION = 8192;
const DEFAULT_MAX_ENCODED_BYTES = 3 * 1024 * 1024;

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('当前浏览器无法读取文件'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('无法读取图片，请重试'));
    };
    reader.onerror = () => reject(new Error(reader.error?.message || '无法读取图片，请重试'));
    reader.onabort = () => reject(new Error('读取图片已取消'));
    reader.readAsDataURL(file);
  });
}

function getTargetDimensions(width, height, maxDimension, hasExplicitDimension) {
  const longestSide = Math.max(width, height);
  const shortestSide = Math.min(width, height);
  const ratio = longestSide / shortestSide;

  if (!hasExplicitDimension && ratio >= 3) {
    const scale = Math.min(1, maxDimension / shortestSide, MAX_LONG_DIMENSION / longestSide);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  const scale = Math.min(1, maxDimension / longestSide);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageElement(file) {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      image,
      release: () => URL.revokeObjectURL(objectUrl),
    });
    image.onerror = () => reject(new Error('无法解码图片，请检查文件后重试'));
    image.src = objectUrl;
  }).catch((error) => {
    URL.revokeObjectURL(objectUrl);
    throw error;
  });
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        release: () => bitmap.close?.(),
      };
    } catch {
      // Try the Image element path in browsers with partial createImageBitmap support.
    }
  }

  return loadImageElement(file);
}

function getEncodedSize(dataUrl) {
  // Data URLs are ASCII, so the string length is also its encoded byte length.
  return typeof dataUrl === 'string' ? dataUrl.length : Number.POSITIVE_INFINITY;
}

function preserveAlpha(mimeType) {
  return /^(image\/(png|webp|avif|svg\+xml))$/i.test(mimeType);
}

export async function fileToOptimizedDataUrl(file, options = {}) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new Error('请选择有效的图片文件');
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ENCODED_BYTES;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('图片大小限制无效');
  }

  // Canvas keeps only one frame. Keep GIF data intact when it fits the upload cap.
  if (file.type.toLowerCase() === 'image/gif') {
    const loaded = await loadImageSource(file);
    try {
      const width = Number(loaded.image.width || loaded.image.naturalWidth);
      const height = Number(loaded.image.height || loaded.image.naturalHeight);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        throw new Error('无法读取 GIF 尺寸，请检查文件后重试');
      }

      const dataUrl = await fileToDataUrl(file);
      if (getEncodedSize(dataUrl) <= maxBytes) return dataUrl;
      throw new Error('GIF 超过 3 MiB，无法在保留动画的情况下压缩，请选择更小的 GIF');
    } finally {
      try {
        loaded.release?.();
      } catch {
        // Keep decode cleanup from masking the file validation or size error.
      }
    }
  }

  const hasExplicitDimension = Object.prototype.hasOwnProperty.call(options, 'maxDimension');
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? 0.72;
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error('图片尺寸限制无效');
  }
  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new Error('图片质量设置无效');
  }

  let source;
  let releaseSource;
  let originalDataUrl;
  try {
    const loaded = await loadImageSource(file);
    source = loaded.image;
    releaseSource = loaded.release;
    const sourceWidth = Number(source.width || source.naturalWidth);
    const sourceHeight = Number(source.height || source.naturalHeight);
    if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) {
      throw new Error('无法读取图片尺寸，请检查文件后重试');
    }

    const target = getTargetDimensions(sourceWidth, sourceHeight, maxDimension, hasExplicitDimension);
    const needsResize = target.width !== sourceWidth || target.height !== sourceHeight;
    if (!needsResize && file.size <= maxBytes) {
      originalDataUrl = await fileToDataUrl(file);
      if (getEncodedSize(originalDataUrl) <= maxBytes) return originalDataUrl;
    }

    let canvas;
    try {
      canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器无法处理图片');

      const keepTransparency = preserveAlpha(file.type);
      const outputType = keepTransparency ? 'image/png' : 'image/jpeg';
      const jpegQualities = [...new Set([quality, 0.58, 0.42, 0.28, 0.18].filter((value) => value <= quality))];
      let width = target.width;
      let height = target.height;

      for (let resizeAttempt = 0; resizeAttempt < 18; resizeAttempt += 1) {
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        if (!keepTransparency) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
        }
        context.drawImage(source, 0, 0, width, height);

        const outputQualities = keepTransparency ? [undefined] : jpegQualities;
        for (const outputQuality of outputQualities) {
          const output = canvas.toDataURL(outputType, outputQuality);
          if (getEncodedSize(output) <= maxBytes) return output;
        }

        const nextWidth = Math.max(1, Math.floor(width * 0.84));
        const nextHeight = Math.max(1, Math.floor(height * 0.84));
        if (nextWidth === width && nextHeight === height) break;
        width = nextWidth;
        height = nextHeight;
      }
    } catch (error) {
      if (!originalDataUrl) originalDataUrl = await fileToDataUrl(file);
      if (getEncodedSize(originalDataUrl) <= maxBytes) return originalDataUrl;
      if (error.message === '当前浏览器无法处理图片') throw error;
    }

    throw new Error('图片压缩后仍超过 3 MiB，请选择更小的图片');
  } catch (error) {
    if (error?.message) throw error;
    throw new Error('无法读取图片，请检查文件后重试');
  } finally {
    try {
      releaseSource?.();
    } catch {
      // Cleanup errors should not replace a successful result or the original processing error.
    }
  }
}

export const MAX_POST_IMAGES = 9;

export function getImageGridLayout(count) {
  if (count <= 1) {
    return {
      gridClass: 'grid-cols-1',
      itemClass: '',
    };
  }

  if (count === 2 || count === 4) {
    return {
      gridClass: 'grid-cols-2',
      itemClass: 'aspect-square',
    };
  }

  return {
    gridClass: 'grid-cols-3',
    itemClass: 'aspect-square',
  };
}
