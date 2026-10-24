import { afterEach, expect, it, vi } from 'vitest';
import { fileToOptimizedDataUrl } from './image';

const objectUrlDescriptors = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of Object.entries(objectUrlDescriptors)) {
    if (descriptor) Object.defineProperty(URL, name, descriptor);
    else delete URL[name];
  }
});

it('rejects non-image files before attempting to read them', async () => {
  const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' });
  await expect(fileToOptimizedDataUrl(file)).rejects.toThrow('请选择有效的图片文件');
});

it('preserves an in-limit animated GIF as its original data URL', async () => {
  const close = vi.fn();
  const decode = vi.fn().mockResolvedValue({ width: 1, height: 1, close });
  vi.stubGlobal('createImageBitmap', decode);
  const bytes = Uint8Array.from(atob('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='), (character) => character.charCodeAt(0));
  const file = new File([bytes], 'animation.gif', { type: 'image/gif' });
  const result = await fileToOptimizedDataUrl(file);
  expect(result).toMatch(/^data:image\/gif;base64,/);
  expect(decode).toHaveBeenCalledWith(file);
  expect(close).toHaveBeenCalledTimes(1);
});

it('rejects malformed GIF data instead of accepting it by MIME type alone', async () => {
  const createObjectURL = vi.fn(() => 'blob:broken-gif');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));
  vi.stubGlobal('Image', class BrokenImage {
    set src(_value) {
      queueMicrotask(() => this.onerror?.());
    }
  });

  const file = new File(['plain text'], 'invalid.gif', { type: 'image/gif' });
  await expect(fileToOptimizedDataUrl(file)).rejects.toThrow('无法解码图片');
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken-gif');
});

it('revokes its temporary object URL when image decoding fails', async () => {
  const createObjectURL = vi.fn(() => 'blob:broken-image');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  vi.stubGlobal('createImageBitmap', undefined);
  vi.stubGlobal('Image', class BrokenImage {
    set src(_value) {
      queueMicrotask(() => this.onerror?.());
    }
  });

  const file = new File(['broken'], 'broken.png', { type: 'image/png' });
  await expect(fileToOptimizedDataUrl(file)).rejects.toThrow('无法解码图片');
  expect(createObjectURL).toHaveBeenCalledWith(file);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken-image');
});

it('preserves long-image resolution and PNG transparency through the size-bounded canvas path', async () => {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 900, height: 8000, close }));
  const drawImage = vi.fn();
  const originalCreateElement = document.createElement.bind(document);
  let canvas;
  vi.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
    if (tagName !== 'canvas') return originalCreateElement(tagName, ...args);
    canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ clearRect: vi.fn(), fillRect: vi.fn(), drawImage }),
      toDataURL: vi.fn((type) => `data:${type};base64,AA==`),
    };
    return canvas;
  });

  const file = new File([new Uint8Array(4 * 1024 * 1024)], 'long.png', { type: 'image/png' });
  const result = await fileToOptimizedDataUrl(file);

  expect(result).toMatch(/^data:image\/png;base64,/);
  expect(canvas.width).toBe(900);
  expect(canvas.height).toBe(8000);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it('honors an explicitly supplied uniform maxDimension for long images', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 900, height: 8000, close: vi.fn() }));
  const originalCreateElement = document.createElement.bind(document);
  let canvas;
  vi.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
    if (tagName !== 'canvas') return originalCreateElement(tagName, ...args);
    canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn() }),
      toDataURL: () => 'data:image/jpeg;base64,AA==',
    };
    return canvas;
  });

  const file = new File([new Uint8Array(4 * 1024 * 1024)], 'long.jpg', { type: 'image/jpeg' });
  await fileToOptimizedDataUrl(file, { maxDimension: 500 });
  expect(canvas.width).toBe(56);
  expect(canvas.height).toBe(500);
});

it('releases the decoded bitmap when canvas processing falls back to the original file', async () => {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2000, height: 2000, close }));
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
    if (tagName !== 'canvas') return originalCreateElement(tagName, ...args);
    return { getContext: () => null };
  });

  const file = new File(['small original'], 'photo.jpg', { type: 'image/jpeg' });
  const result = await fileToOptimizedDataUrl(file);
  expect(result).toMatch(/^data:image\/jpeg;base64,/);
  expect(close).toHaveBeenCalledTimes(1);
});
