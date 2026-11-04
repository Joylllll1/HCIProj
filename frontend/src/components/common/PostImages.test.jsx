import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PostImages from './PostImages';
vi.mock('./ClickableImage', () => ({
  default: ({ src, alt, onImageLoad, images, imageIndex }) => <button type="button" aria-label={`查看第 ${imageIndex + 1} 张`} data-images={JSON.stringify(images)}><img src={src} alt={alt} onLoad={onImageLoad} /></button>,
}));
afterEach(cleanup);

it('normalizes legacy empty values before assigning gallery positions', () => {
  render(<PostImages title="校园照片" images={['', 'first.png', null, 'second.png']} />);
  expect(screen.getByRole('figure')).toHaveAccessibleName('2 张帖子图片');
  expect(screen.getByRole('button', { name: '查看第 2 张' })).toHaveAttribute('data-images', JSON.stringify(['first.png', 'second.png']));
  expect(screen.getByAltText('校园照片，图片 2')).toHaveAttribute('src', 'second.png');
});

it.each([1, 2, 3, 4, 9])('keeps all %i images discoverable with a visible viewing hint', (count) => {
  render(<PostImages images={Array.from({ length: count }, (_, index) => `${index}.png`)} />);
  expect(screen.getAllByRole('button')).toHaveLength(count);
  expect(screen.getByText(count > 1 ? `${count} 张图片 · 点击查看大图` : '点击查看大图')).toBeInTheDocument();
});

it('identifies a long image after loading so cropping is explicitly signposted', () => {
  render(<PostImages images={['long.png']} />);
  const img = screen.getByRole('img');
  Object.defineProperties(img, { naturalWidth: { value: 900 }, naturalHeight: { value: 6000 } });
  fireEvent.load(img);
  expect(screen.getByText('长图 · 点击查看')).toBeInTheDocument();
  expect(img.closest('.post-media-cell')).toHaveClass('is-long-image');
});

it('renders nothing for malformed or empty gallery values', () => {
  const { container, rerender } = render(<PostImages images={null} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<PostImages images={['', null]} />);
  expect(container).toBeEmptyDOMElement();
});
