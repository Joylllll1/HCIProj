import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyPostsPage from './MyPostsPage';
import usePostStore from '../../store/postStore';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
beforeEach(() => {
  useAuthStore.setState({ user: { _id: 'owner' } });
  useUiStore.setState({ query: '' });
  usePostStore.setState({ myPosts: [{ id: 'mine', ownerUserId: 'owner', title: '待删除的帖子', content: '内容' }], fetchMyPosts: vi.fn().mockResolvedValue(), deletePost: vi.fn().mockRejectedValueOnce(new Error('网络断开，请重试')).mockImplementationOnce(async () => { usePostStore.setState({ myPosts: [] }); }) });
});
afterEach(cleanup);
it('names the post and keeps a failed deletion available for retry', async () => {
  render(<MyPostsPage onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '删除帖子：待删除的帖子' }));
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription('“待删除的帖子”删除后无法恢复。');
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络断开，请重试');
  expect(screen.getByRole('button', { name: '待删除的帖子', exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(usePostStore.getState().deletePost).toHaveBeenCalledTimes(2);
});
