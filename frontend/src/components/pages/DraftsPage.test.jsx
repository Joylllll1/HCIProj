import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DraftsPage from './DraftsPage';
import useAuthStore from '../../store/authStore';
import * as draftService from '../../services/draftService';

vi.mock('../../services/draftService', () => ({ fetchDrafts: vi.fn(), deleteDraft: vi.fn(), deleteDrafts: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: true });
});
afterEach(cleanup);

it('keeps selected drafts until deletion is explicitly confirmed', async () => {
  draftService.fetchDrafts.mockResolvedValue([{ id: 'draft-a', title: '还没写完', content: '内容', updatedAt: new Date().toISOString() }]);
  draftService.deleteDrafts.mockResolvedValue({});
  render(<DraftsPage onNavigate={vi.fn()} />);
  await screen.findByRole('button', { name: '还没写完', exact: true });
  fireEvent.click(screen.getByRole('button', { name: '批量管理' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择草稿：还没写完' }));
  fireEvent.click(screen.getByRole('button', { name: '删除选中' }));
  expect(draftService.deleteDrafts).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '还没写完', exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '删除选中' }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '还没写完', exact: true })).not.toBeInTheDocument());
  expect(draftService.deleteDrafts).toHaveBeenCalledWith(['draft-a']);
});

it('distinguishes a failed load from an empty box and supports retry', async () => {
  draftService.fetchDrafts.mockRejectedValueOnce(new Error('网络暂时不可用')).mockResolvedValueOnce([]);
  render(<DraftsPage onNavigate={vi.fn()} />);
  await screen.findByRole('alert');
  expect(screen.queryByText('还没有草稿')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
  await screen.findByText('还没有草稿');
  expect(draftService.fetchDrafts).toHaveBeenCalledTimes(2);
});

it('offers a direct single delete with a named confirmation, cancel and focus recovery', async () => {
  draftService.fetchDrafts.mockResolvedValue([
    { id: 'a', title: '第一篇', content: '内容' },
    { id: 'b', title: '第二篇', content: '内容' },
  ]);
  draftService.deleteDraft.mockResolvedValue({});
  render(<DraftsPage onNavigate={vi.fn()} />);
  const trigger = await screen.findByRole('button', { name: '删除草稿：第一篇' });
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription('“第一篇”删除后无法恢复。');
  expect(screen.getByRole('button', { name: '保留草稿' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(draftService.deleteDraft).not.toHaveBeenCalled();
  fireEvent.click(trigger); fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '第一篇', exact: true })).not.toBeInTheDocument());
  expect(draftService.deleteDraft).toHaveBeenCalledWith('a');
  expect(draftService.deleteDrafts).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: '第二篇', exact: true })).toHaveFocus());
});

it('keeps the single draft and shows an actionable error until a retry succeeds', async () => {
  draftService.fetchDrafts.mockResolvedValue([{ id: 'a', title: '保留我的内容', content: '内容' }]);
  let finish;
  draftService.deleteDraft.mockRejectedValueOnce(new Error('网络断开，请重试')).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<DraftsPage onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '删除草稿：保留我的内容' }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络断开，请重试');
  expect(screen.getByRole('button', { name: '保留我的内容', exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  fireEvent.click(screen.getByRole('button', { name: '删除中…' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(draftService.deleteDraft).toHaveBeenCalledTimes(2);
  finish({});
  await screen.findByText('还没有草稿');
  await waitFor(() => expect(screen.getByRole('button', { name: '开始写树洞' })).toHaveFocus());
});

it('selects all and exits batch mode without changing drafts', async () => {
  draftService.fetchDrafts.mockResolvedValue([{ id: 'a', title: '第一篇' }, { id: 'b', title: '第二篇' }]);
  render(<DraftsPage onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '批量管理' }));
  expect(screen.getByRole('button', { name: '删除选中' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '全选', exact: true }));
  screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeChecked());
  fireEvent.click(screen.getByRole('button', { name: '退出批量管理' }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^删除草稿：/ })).toHaveLength(2);
  expect(draftService.deleteDrafts).not.toHaveBeenCalled();
});
