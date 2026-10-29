import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReportModal from './ReportModal';

afterEach(cleanup);

it('labels the report dialog, traps focus, and preserves the reason while editing', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  render(<ReportModal targetId="post-1" targetType="post" onClose={onClose} onSubmit={onSubmit} />);
  expect(screen.getByRole('dialog', { name: '举报帖子' })).toBeInTheDocument();
  const close = screen.getByRole('button', { name: '关闭' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  fireEvent.click(screen.getByRole('radio', { name: '其他' }));
  fireEvent.change(screen.getByRole('textbox', { name: '请详细说明原因：' }), { target: { value: '具体原因' } });
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }));
  expect(onSubmit).toHaveBeenCalledWith('post-1', '具体原因');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});
