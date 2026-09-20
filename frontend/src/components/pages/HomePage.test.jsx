import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import useAuthStore from '../../store/authStore';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';

vi.mock('../../services/postService', () => ({
  fetchPosts: vi.fn(),
  fetchPostById: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  toggleLike: vi.fn(),
  toggleSave: vi.fn(),
  fetchLikes: vi.fn(),
  fetchSavedPosts: vi.fn(),
  fetchMyPosts: vi.fn(),
  toggleCommentLike: vi.fn(),
  toggleReplyLike: vi.fn(),
}));

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../features/HeroCarousel', () => ({
  default: () => <div data-testid="hero-carousel" />,
}));

vi.mock('../common/PostCard', () => ({
  default: ({ post }) => <div>{post.title}</div>,
}));

vi.mock('../common/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../features/DailyFortune', () => ({
  default: () => <div data-testid="daily-fortune" />,
}));

vi.mock('../../hooks/usePostActions', () => ({
  default: () => ({ openPost: vi.fn() }),
}));

vi.mock('../../hooks/useLikeBookmark', () => ({
  default: () => ({ toggleLike: vi.fn(), toggleBookmark: vi.fn() }),
}));

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.close = vi.fn();
    MockEventSource.instances.push(this);
  }

  addEventListener(event, handler) {
    this.listeners.set(event, handler);
  }

  emit(event, data = {}) {
    const handler = this.listeners.get(event);
    if (handler) {
      handler({ data: JSON.stringify(data) });
    }
  }
}

const existingPosts = [
  {
    id: 'post-1',
    title: 'Existing post',
    content: 'content',
    createdAt: '2026-05-26T00:00:00.000Z',
    tags: ['树洞'],
    likes: 0,
    comments: 0,
    saves: 0,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'post-2',
    title: 'Second post',
    content: 'content',
    createdAt: '2026-05-26T00:00:00.000Z',
    tags: ['树洞'],
    likes: 0,
    comments: 0,
    saves: 0,
    isLiked: false,
    isSaved: false,
  },
];

describe('HomePage SSE updates', () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    usePostStore.setState(usePostStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);
    MockEventSource.instances = [];
    vi.clearAllMocks();

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
    useUiStore.setState({
      query: '',
      navigate: vi.fn(),
      showToast: vi.fn(),
    });
    usePostStore.setState({
      fetchPosts: vi.fn().mockResolvedValue(undefined),
      loadMorePosts: vi.fn().mockResolvedValue(undefined),
    });
    usePostStore.setState({
      posts: existingPosts,
      likedPosts: [],
      loading: false,
      loadingMore: false,
      currentPage: 1,
      totalPages: 1,
      totalPosts: existingPosts.length,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the existing list visible during a silent refresh', async () => {
    render(<HomePage />);

    expect(screen.getByText('Existing post')).toBeInTheDocument();
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });

  it('fetches posts on first mount', () => {
    const fetchPosts = vi.fn().mockResolvedValue(undefined);
    usePostStore.setState({
      posts: [],
      loading: false,
      fetchPosts,
    });

    render(<HomePage />);

    expect(fetchPosts).toHaveBeenCalledTimes(1);
    expect(fetchPosts).toHaveBeenCalledWith(1, '', { sort: 'latest' });
  });

  it('re-fetches from the backend when the search query changes', async () => {
    const fetchPosts = vi.fn().mockResolvedValue(undefined);
    usePostStore.setState({
      fetchPosts,
      posts: [],
      loading: false,
      totalPosts: 0,
    });

    const { rerender } = render(<HomePage />);

    useUiStore.setState({ query: '宿舍' });
    rerender(<HomePage />);

    await waitFor(() => {
      expect(fetchPosts).toHaveBeenCalledWith(1, '宿舍', { sort: 'latest' });
    });
  });

  it('shows load more and requests the next page from the store', () => {
    const loadMorePosts = vi.fn().mockResolvedValue(undefined);
    usePostStore.setState({
      posts: existingPosts,
      loading: false,
      loadingMore: false,
      currentPage: 1,
      totalPages: 3,
      totalPosts: 42,
      loadMorePosts,
    });

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));

    expect(loadMorePosts).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from the backend with hot sort when switching tabs', async () => {
    const fetchPosts = vi.fn().mockResolvedValue(undefined);
    usePostStore.setState({
      fetchPosts,
      posts: existingPosts,
      loading: false,
    });

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: '高赞共鸣' }));

    await waitFor(() => {
      expect(fetchPosts).toHaveBeenCalledWith(1, '', { sort: 'hot' });
    });
  });

  it('shows pending state on sort tabs until the new feed finishes loading', async () => {
    let resolveFetch;
    const fetchPosts = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    usePostStore.setState({
      fetchPosts,
      posts: existingPosts,
      loading: false,
    });

    render(<HomePage />);

    const hotButton = screen.getByRole('button', { name: '高赞共鸣' });
    fireEvent.click(hotButton);

    expect(screen.getByRole('button', { name: '高赞共鸣 · 加载中' })).toBeDisabled();
    expect(screen.getByText('Existing post')).toBeInTheDocument();

    resolveFetch?.();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '高赞共鸣' })).toBeInTheDocument();
    });
  });

  it('removes a deleted post when store removes it', async () => {
    render(<HomePage />);

    expect(screen.getByText('Existing post')).toBeInTheDocument();
    expect(screen.getByText('Second post')).toBeInTheDocument();

    usePostStore.getState().removePostById('post-1');

    await waitFor(() => {
      expect(screen.queryByText('Existing post')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Second post')).toBeInTheDocument();
  });

});
