export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error('读取图片失败'));
    };
    reader.readAsDataURL(file);
  });
}

export async function fileToOptimizedDataUrl(file, options = {}) {
  const {
    maxDimension = 1280,
    quality = 0.72,
  } = options;

  if (!file?.type?.startsWith('image/')) {
    return fileToDataUrl(file);
  }

  let imageSource;
  let revokeUrl = null;

  if (typeof createImageBitmap === 'function') {
    imageSource = await createImageBitmap(file);
  } else {
    const sourceUrl = URL.createObjectURL(file);
    revokeUrl = sourceUrl;
    imageSource = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('读取图片失败'));
      image.src = sourceUrl;
    });
  }

  try {
    const widthBase = imageSource.width;
    const heightBase = imageSource.height;
    const scale = Math.min(1, maxDimension / Math.max(widthBase, heightBase));
    const width = Math.max(1, Math.round(widthBase * scale));
    const height = Math.max(1, Math.round(heightBase * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fileToDataUrl(file);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(imageSource, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (typeof imageSource?.close === 'function') {
      imageSource.close();
    }
    if (revokeUrl) {
      URL.revokeObjectURL(revokeUrl);
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
