import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyPage from './MyPage';
import { fetchSavedPosts } from '../../services/postService';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';

vi.mock('../../services/postService', () => ({ fetchSavedPosts: vi.fn() }));
vi.mock('./MyPostsPage', () => ({ default: () => <p>我的帖子分区</p> }));
vi.mock('./LikesPage', () => ({ default: () => <p>我的喜爱分区</p> }));
vi.mock('../common/Icon', () => ({ default: () => null }));
vi.mock('../common/PostCard', () => ({ default: ({ post }) => <p>{post.title}</p> }));

beforeEach(() => {
  usePostStore.setState(usePostStore.getInitialState(), true);
  usePostStore.setState({ getPostLikeView: (post) => post });
  useUiStore.setState({ query: '', myTab: 'posts', bookmarkFolder: 'all' });
  fetchSavedPosts.mockResolvedValue([{ id: 'p', title: '选课经验', content: '内容' }]);
});
afterEach(cleanup);

it('restores the selected personal section when returning from a detail page', () => {
  const props = { posts: [], bookmarks: [], likedPosts: [], collectionFolders: [{ id: 'all', name: '全部', isDefault: true }] };
  const first = render(<MyPage {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '我的收藏' }));
  expect(screen.getByRole('button', { name: '我的收藏' })).toHaveAttribute('aria-pressed', 'true');
  first.unmount();
  render(<MyPage {...props} />);
  expect(screen.getByRole('button', { name: '我的收藏' })).toHaveAttribute('aria-pressed', 'true');
});

it('provides the same move action in personal space and clears management on tab/account changes', async () => {
  const onMoveBookmarks = vi.fn().mockResolvedValue({ results: [{ postId: 'p', status: 'moved' }] });
  const props = { accountKey: 'actor', posts: [{ id: 'p', title: '选课经验', content: '内容' }], bookmarks: ['p'], onMoveBookmarks,
    collectionFolders: [{ id: 'all', name: '全部', isDefault: true }, { id: 'b', name: '课程' }] };
  const { rerender } = render(<MyPage {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '我的收藏' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '批量管理' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '批量管理' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：选课经验' }));
  fireEvent.click(screen.getByRole('button', { name: '移动到' }));
  fireEvent.click(screen.getByRole('radio', { name: '课程' }));
  fireEvent.click(screen.getByRole('button', { name: '移动 1 篇' }));
  await screen.findByText('已移动 1 篇');
  expect(onMoveBookmarks).toHaveBeenCalledWith(['p'], 'b');
  fireEvent.click(screen.getByRole('button', { name: '我的帖子' }));
  fireEvent.click(screen.getByRole('button', { name: '我的收藏' }));
  expect(screen.queryByText('已选 0 篇')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '批量管理' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '批量管理' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：选课经验' }));
  rerender(<MyPage {...props} accountKey="another" bookmarks={[]} />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '批量管理' })).toBeDisabled();
});
