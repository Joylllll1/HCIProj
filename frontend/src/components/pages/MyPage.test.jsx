import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MyPage from './MyPage';
import useUiStore from '../../store/uiStore';
vi.mock('./MyPostsPage', () => ({ default: () => <p>帖子内容</p> }));
vi.mock('./BookmarksPage', () => ({ default: () => <p>收藏内容</p> }));
vi.mock('./LikesPage', () => ({ default: () => <p>喜爱内容</p> }));
beforeEach(() => useUiStore.setState({ myTab: 'posts' }));
afterEach(cleanup);
it('restores the selected personal section when returning from a detail page', () => {
  const first = render(<MyPage />);
  fireEvent.click(screen.getByRole('button', { name: '我的收藏' }));
  expect(screen.getByText('收藏内容')).toBeInTheDocument();
  first.unmount();
  render(<MyPage />);
  expect(screen.getByRole('button', { name: '我的收藏' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('收藏内容')).toBeInTheDocument();
});
