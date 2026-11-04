import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClickableImage from './ClickableImage';

afterEach(cleanup);

it('provides a descriptive dialog trigger and reports the loaded image', () => {
  const dimensions = [];
  const onImageLoad = vi.fn((event) => {
    dimensions.push([event.currentTarget.naturalWidth, event.currentTarget.naturalHeight]);
  });
  render(
    <ClickableImage
      src="/photo.jpg"
      alt="校园活动照片"
      images={['/photo.jpg', '/poster.jpg']}
      imageIndex={1}
      onImageLoad={onImageLoad}
    />,
  );

  const trigger = screen.getByRole('button', { name: '查看图片：校园活动照片（第 2 张，共 2 张）' });
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  expect(trigger).toHaveClass('h-full');
  expect(trigger).toHaveClass('w-full');

  const image = screen.getByRole('img', { name: '校园活动照片' });
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 900 });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 2400 });
  fireEvent.load(image);
  expect(onImageLoad).toHaveBeenCalledTimes(1);
  expect(dimensions).toEqual([[900, 2400]]);

  fireEvent.click(trigger);
  return waitFor(() => expect(screen.getByRole('dialog', { name: '图片预览' })).toBeInTheDocument());
});

it('shows a retry state after an image error and retries on the next activation', () => {
  render(<ClickableImage src="/missing.jpg" alt="损坏的图片" />);

  const image = screen.getByRole('img', { name: '损坏的图片' });
  fireEvent.error(image);
  const retry = screen.getByRole('button', { name: '图片加载失败，点击重试：损坏的图片' });
  expect(screen.getByRole('status')).toHaveTextContent('图片加载失败，点击重试');

  fireEvent.click(retry);
  expect(screen.getByRole('img', { name: '损坏的图片' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('图片加载中');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('stops viewer controls and close clicks from bubbling into an ancestor card', async () => {
  const onCardClick = vi.fn();
  render(
    <div onClick={onCardClick}>
      <ClickableImage src="/one.jpg" alt="活动图片" images={['/one.jpg', '/two.jpg']} />
    </div>,
  );

  const trigger = screen.getByRole('button', { name: '查看图片：活动图片（第 1 张，共 2 张）' });
  fireEvent.load(screen.getByRole('img', { name: '活动图片' }));
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: '图片预览' });

  const preview = screen.getByRole('img', { name: '预览图片 1' });
  Object.defineProperty(preview, 'naturalWidth', { configurable: true, value: 640 });
  Object.defineProperty(preview, 'naturalHeight', { configurable: true, value: 480 });
  fireEvent.load(preview);
  fireEvent.click(screen.getByRole('button', { name: '放大图片' }));
  fireEvent.click(screen.getByRole('button', { name: '下一张' }));
  expect(screen.getByText('2 / 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭预览' }));

  expect(onCardClick).not.toHaveBeenCalled();
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});
