import React, { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import useDialogFocus from './useDialogFocus';
import ConfirmLeaveDialog from '../components/common/ConfirmLeaveDialog';
afterEach(cleanup);
function FieldsetDialog() {
  const ref = useRef(null);
  useDialogFocus(ref, true, vi.fn());
  return <section ref={ref} role="dialog"><fieldset disabled><button type="button">禁用操作</button></fieldset><button type="button">关闭</button></section>;
}
it('skips descendants of a disabled fieldset when selecting and trapping focus', () => {
  render(<FieldsetDialog />);
  expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
});
it('keeps pending confirmations focusable when every action becomes disabled', () => {
  const cancel = vi.fn();
  const props = { open: true, title: '删除？', description: '内容不可恢复', confirmText: '删除', cancelText: '取消', onCancel: cancel, onConfirm: vi.fn() };
  const { rerender } = render(<ConfirmLeaveDialog {...props} />);
  screen.getByRole('button', { name: '删除' }).focus();
  rerender(<ConfirmLeaveDialog {...props} pending />);
  expect(screen.getByRole('dialog')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('dialog')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(cancel).not.toHaveBeenCalled();
  rerender(<ConfirmLeaveDialog {...props} pending={false} error="删除失败" />);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '删除' })).toHaveFocus();
});
