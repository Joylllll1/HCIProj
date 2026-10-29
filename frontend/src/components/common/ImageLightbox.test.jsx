import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImageLightbox from './ImageLightbox';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

function PreviewHarness({ images, initialIndex = 0, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开图片</button>
      {open && (
        <ImageLightbox
          images={images}
          initialIndex={initialIndex}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

it('opens at the requested index, wraps keyboard navigation, and restores focus on Escape', async () => {
  const onClose = vi.fn();
  render(<PreviewHarness images={['/one.jpg', '/two.jpg']} initialIndex={1} onClose={onClose} />);
  const trigger = screen.getByRole('button', { name: '打开图片' });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog', { name: '图片预览' });
  expect(screen.getByText('2 / 2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '查看第 1 张图片' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '查看第 2 张图片' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: '关闭预览' })).toHaveFocus();

  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(screen.getByText('1 / 2')).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'ArrowLeft' });
  expect(screen.getByText('2 / 2')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(trigger).toHaveFocus();
});

it('locks body scrolling and restores its prior inline values when closed', async () => {
  document.body.style.overflow = 'auto';
  document.body.style.paddingRight = '12px';
  const { rerender } = render(<ImageLightbox images={['/one.jpg']} onClose={vi.fn()} />);
  await screen.findByRole('dialog', { name: '图片预览' });
  expect(document.body.style.overflow).toBe('hidden');

  rerender(<div>closed</div>);
  await waitFor(() => expect(document.body.style.overflow).toBe('auto'));
  expect(document.body.style.paddingRight).toBe('12px');
});
