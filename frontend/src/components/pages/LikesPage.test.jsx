import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LikesPage from './LikesPage';
import usePostStore from '../../store/postStore';
import useCommentStore from '../../store/commentStore';
import useUiStore from '../../store/uiStore';
import { fetchLikes } from '../../services/postService';

vi.mock('../../services/postService', () => ({
  fetchLikes: vi.fn(),
  fetchPostById: vi.fn(),
}));

vi.mock('../common/PostCard', () => ({
  default: ({ post }) => <div>{post.title}</div>,
}));

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../common/ExpandableText', () => ({
  default: ({ content }) => <div>{content}</div>,
}));

vi.mock('../common/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

describe('LikesPage progressive loading', () => {
  const likedPosts = Array.from({ length: 25 }, (_, index) => ({
    id: `post-${index + 1}`,
    title: `Liked post ${index + 1}`,
    content: 'content',
    isLiked: true,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    usePostStore.setState(usePostStore.getInitialState(), true);
    useCommentStore.setState(useCommentStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);
    useUiStore.setState({
      query: '',
      showToast: vi.fn(),
    });
    usePostStore.setState({
      getPostLikeView: (post) => post,
      togglePendingUnlike: vi.fn(),
      submitPendingUnlikes: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
      pendingUnlikePostIds: [],
    });
    useCommentStore.setState({
      togglePendingUnlike: vi.fn(),
      submitPendingCommentUnlikes: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
      pendingCommentUnlikes: [],
      isPendingUnlike: () => false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows posts in batches and loads more when requested', async () => {
    fetchLikes.mockResolvedValue({
      posts: likedPosts,
      comments: [],
    });

    render(
      <LikesPage
        posts={likedPosts}
        likedPosts={likedPosts.map((post) => post.id)}
        onOpenPost={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Liked post 20')).toBeInTheDocument();
    });

    expect(screen.queryByText('Liked post 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(screen.getByText('Liked post 25')).toBeInTheDocument();
  });
});
