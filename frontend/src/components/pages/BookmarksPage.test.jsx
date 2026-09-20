import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookmarksPage from './BookmarksPage';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';

vi.mock('../../services/postService', () => ({
  fetchSavedPosts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../common/PostCard', () => ({
  default: ({ post }) => <div>{post.title}</div>,
}));

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../common/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

describe('BookmarksPage progressive loading', () => {
  const savedPosts = Array.from({ length: 25 }, (_, index) => ({
    id: `post-${index + 1}`,
    title: `Saved post ${index + 1}`,
    content: 'content',
    isLiked: false,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    usePostStore.setState(usePostStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);
    useUiStore.setState({
      query: '',
      showToast: vi.fn(),
    });
    usePostStore.setState({
      getPostLikeView: (post) => post,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows bookmarked posts in batches and loads more when requested', async () => {
    render(
      <BookmarksPage
        posts={savedPosts}
        bookmarks={savedPosts.map((post) => post.id)}
        onOpenPost={vi.fn()}
        onLike={vi.fn()}
        onBookmark={vi.fn()}
        onReport={vi.fn()}
        collectionFolders={[{ id: 'all', name: '全部', isDefault: true }]}
        bookmarkFolders={{}}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Saved post 20')).toBeInTheDocument();
    });

    expect(screen.queryByText('Saved post 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(screen.getByText('Saved post 25')).toBeInTheDocument();
  });
});
