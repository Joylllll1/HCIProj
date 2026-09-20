import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import useAuthStore from './store/authStore';
import useBookmarkStore from './store/bookmarkStore';
import useCommentStore from './store/commentStore';
import useNotificationStore from './store/notificationStore';
import usePostStore from './store/postStore';
import useUiStore from './store/uiStore';

const { restoreSession, fetchPostById } = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  fetchPostById: vi.fn(),
}));
const { refreshSession } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
}));

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.close = vi.fn();
    this.onerror = null;
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

vi.mock('./hooks/useAuth', () => ({
  default: () => ({
    isAuthenticated: true,
    restoreSession,
  }),
}));

vi.mock('./hooks/useLikeBookmark', () => ({
  default: () => ({
    toggleLike: vi.fn(),
    toggleBookmark: vi.fn(),
    selectFolder: vi.fn(),
  }),
}));

vi.mock('./hooks/usePostActions', () => ({
  default: () => ({ openPost: vi.fn() }),
}));

vi.mock('./hooks/useNotificationPolling', () => ({
  default: () => {},
}));

vi.mock('./services/postService', async () => {
  const actual = await vi.importActual('./services/postService');
  return {
    ...actual,
    fetchPostById,
  };
});

vi.mock('./services/apiClient', async () => {
  const actual = await vi.importActual('./services/apiClient');
  return {
    ...actual,
    refreshSession,
  };
});

vi.mock('./services/reportService', () => ({
  createReport: vi.fn(),
}));

vi.mock('./components/common/Toast', () => ({
  default: () => <div data-testid="toast" />,
}));

vi.mock('./components/common/ConfirmLeaveDialog', () => ({
  default: () => null,
}));

vi.mock('./components/layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock('./components/layout/TopBar', () => ({
  default: () => <div data-testid="topbar" />,
}));

vi.mock('./components/features/AIPanel', () => ({
  default: () => null,
}));

vi.mock('./components/pages/HomePage', () => ({
  default: () => <div>home-page</div>,
}));

vi.mock('./components/pages/SettingsPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/PasswordChangePage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/LandingPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/LoginPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/RegisterPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/ForgetPasswordPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/BookmarksPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/DetailPage', () => ({
  default: ({ post, onDelete, comments = [] }) => (
    <div>
      <div data-testid="detail-post-id">{post.id}</div>
      <button type="button" onClick={() => onDelete(post.id)}>
        delete-post
      </button>
      <div data-testid="detail-comment-count">{comments.length}</div>
    </div>
  ),
}));

vi.mock('./components/pages/ComposePage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/DraftsPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/LikesPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/MyPostsPage', () => ({
  default: () => null,
}));

vi.mock('./components/pages/AdminDashboard', () => ({
  default: () => null,
}));

vi.mock('./components/pages/AnnouncementsPage', () => ({
  default: () => null,
}));

vi.mock('./components/common/UnderConstruction', () => ({
  default: () => null,
}));

vi.mock('./components/common/EmptyState', () => ({
  default: () => null,
}));

describe('App detail deletion flow', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource;
    refreshSession.mockResolvedValue({});
    window.history.pushState({}, '', '/detail/post-1');

    useAuthStore.setState(useAuthStore.getInitialState(), true);
    useBookmarkStore.setState(useBookmarkStore.getInitialState(), true);
    useCommentStore.setState(useCommentStore.getInitialState(), true);
    useNotificationStore.setState(useNotificationStore.getInitialState(), true);
    usePostStore.setState(usePostStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);

    const showToast = vi.fn();

    useAuthStore.setState({
      initialized: true,
      user: { _id: 'user-1', role: 'user' },
      isAuthenticated: true,
    });
    useBookmarkStore.setState({
      folderSelectorOpen: false,
      closeFolderSelector: vi.fn(),
      collectionFolders: [],
      bookmarks: [],
      bookmarkFolders: {},
      createFolder: vi.fn(),
      renameFolder: vi.fn(),
      deleteFolder: vi.fn(),
      loadBookmarks: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
    });
    useCommentStore.setState({
      commentsMap: {},
      fetchComments: vi.fn(),
      addComment: vi.fn(),
      upsertComment: useCommentStore.getState().upsertComment,
      removeComment: useCommentStore.getState().removeComment,
      upsertReply: useCommentStore.getState().upsertReply,
      removeReply: useCommentStore.getState().removeReply,
      deleteComment: vi.fn(),
      deleteReply: vi.fn(),
    });
    useNotificationStore.setState({
      fetchNotifications: vi.fn().mockResolvedValue([]),
      fetchUnreadCount: vi.fn().mockResolvedValue(0),
      reset: vi.fn(),
    });
    usePostStore.setState({
      selectedPost: {
        id: 'post-1',
        ownerUserId: 'user-1',
        title: 'Detail post',
        tags: ['树洞'],
      },
      posts: [],
      likedPosts: [],
      getPostLikeView: (post) => post,
      deletePost: vi.fn().mockResolvedValue(undefined),
    });
    useUiStore.setState({
      activePage: 'detail',
      toast: null,
      query: '',
      draftId: null,
      aiOpen: false,
      leaveConfirm: { open: false },
      clearToast: vi.fn(),
      showToast,
      closeAi: vi.fn(),
      closeLeaveConfirm: vi.fn(),
      confirmPendingNavigation: vi.fn(),
      discardPendingNavigation: vi.fn(),
      setQuery: vi.fn(),
      navigate: (page) => {
        useUiStore.setState({ activePage: page });
      },
    });
  });

  it('does not re-fetch the deleted post after leaving detail view', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'delete-post' }));

    await waitFor(() => {
      expect(useUiStore.getState().activePage).toBe('home');
    });

    expect(usePostStore.getState().selectedPost).toBeNull();
    expect(fetchPostById).not.toHaveBeenCalled();
    expect(useUiStore.getState().showToast).toHaveBeenCalledWith('帖子已删除');
    expect(useUiStore.getState().showToast).not.toHaveBeenCalledWith('加载帖子失败');
  });

  it('shows a loading state and fetches the post when detail page opens with only a route id', async () => {
    window.history.pushState({}, '', '/detail/post-2');
    fetchPostById.mockResolvedValueOnce({
      id: 'post-2',
      ownerUserId: 'user-2',
      title: 'Fetched detail post',
      tags: ['树洞'],
      comments: 0,
    });
    usePostStore.setState({
      selectedPost: null,
      posts: [],
      likedPosts: [],
      getPostLikeView: (post) => post,
      deletePost: vi.fn().mockResolvedValue(undefined),
    });

    render(<App />);

    expect(screen.getByText('正在加载帖子详情...')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchPostById).toHaveBeenCalledWith('post-2');
      expect(screen.getByTestId('detail-post-id')).toHaveTextContent('post-2');
    });
  });

  it('deduplicates comment-created SSE updates and increments count once', async () => {
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            ownerUserId: 'user-2',
            content: 'existing',
            replies: [],
          },
        ],
      },
    });
    usePostStore.setState({
      selectedPost: {
        id: 'post-1',
        ownerUserId: 'user-1',
        title: 'Detail post',
        tags: ['树洞'],
        comments: 1,
      },
      posts: [
        {
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Detail post',
          tags: ['树洞'],
          comments: 1,
        },
      ],
      getPostLikeView: (post) => post,
    });

    render(<App />);

    const es = MockEventSource.instances[0];
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 2,
    });
    es.emit('comment-created', {
      postId: 'post-1',
      comment: {
        id: 'comment-2',
        ownerUserId: 'user-3',
        content: 'new comment',
        replies: [],
      },
    });
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 2,
    });
    es.emit('comment-created', {
      postId: 'post-1',
      comment: {
        id: 'comment-2',
        ownerUserId: 'user-3',
        content: 'new comment',
        replies: [],
      },
    });

    await waitFor(() => {
      expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(2);
    });

    expect(usePostStore.getState().posts[0].comments).toBe(2);
    expect(screen.getByTestId('detail-comment-count')).toHaveTextContent('2');
  });

  it('removes reply on reply-deleted SSE and decrements count once', async () => {
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            ownerUserId: 'user-2',
            content: 'existing',
            replies: [
              {
                id: 'reply-1',
                ownerUserId: 'user-3',
                content: 'reply',
              },
            ],
          },
        ],
      },
    });
    usePostStore.setState({
      selectedPost: {
        id: 'post-1',
        ownerUserId: 'user-1',
        title: 'Detail post',
        tags: ['树洞'],
        comments: 2,
      },
      posts: [
        {
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Detail post',
          tags: ['树洞'],
          comments: 2,
        },
      ],
      getPostLikeView: (post) => post,
    });

    render(<App />);

    const es = MockEventSource.instances[0];
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 1,
    });
    es.emit('reply-deleted', {
      postId: 'post-1',
      commentId: 'comment-1',
      replyId: 'reply-1',
    });
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 1,
    });
    es.emit('reply-deleted', {
      postId: 'post-1',
      commentId: 'comment-1',
      replyId: 'reply-1',
    });

    await waitFor(() => {
      expect(useCommentStore.getState().commentsMap['post-1'][0].replies).toHaveLength(0);
    });

    expect(usePostStore.getState().posts[0].comments).toBe(1);
    expect(screen.getByTestId('detail-comment-count')).toHaveTextContent('1');
  });

  it('reconnects SSE after refreshing the session on stream auth failure', async () => {
    render(<App />);

    expect(MockEventSource.instances).toHaveLength(1);

    await MockEventSource.instances[0].onerror?.();

    await waitFor(() => {
      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(2);
    });

    expect(MockEventSource.instances[0].close).toHaveBeenCalled();
    expect(MockEventSource.instances[1].url).toBe('/api/stream');
  });

  it('refreshes notifications when notification-updated SSE arrives', async () => {
    render(<App />);

    const es = MockEventSource.instances[0];
    const fetchNotifications = useNotificationStore.getState().fetchNotifications;
    const fetchUnreadCount = useNotificationStore.getState().fetchUnreadCount;

    es.emit('notification-updated', {
      notificationId: 'notif-1',
      type: 'comment',
    });

    await waitFor(() => {
      expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
    });
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('applies post stats updates from SSE without refetching', async () => {
    usePostStore.setState({
      selectedPost: {
        id: 'post-1',
        ownerUserId: 'user-1',
        title: 'Detail post',
        tags: ['树洞'],
        likes: 1,
        saves: 2,
      },
      posts: [
        {
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Detail post',
          tags: ['树洞'],
          likes: 1,
          saves: 2,
        },
      ],
      myPosts: [
        {
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Detail post',
          tags: ['树洞'],
          likes: 1,
          saves: 2,
        },
      ],
      getPostLikeView: usePostStore.getState().getPostLikeView,
    });

    render(<App />);

    const es = MockEventSource.instances[0];
    es.emit('post-stats-updated', {
      postId: 'post-1',
      likes: 5,
      saves: 7,
      comments: 4,
    });

    await waitFor(() => {
      expect(usePostStore.getState().posts[0].likes).toBe(5);
    });

    expect(usePostStore.getState().posts[0].saves).toBe(7);
    expect(usePostStore.getState().myPosts[0].likes).toBe(5);
    expect(usePostStore.getState().myPosts[0].saves).toBe(7);
    expect(usePostStore.getState().myPosts[0].comments).toBe(4);
    expect(usePostStore.getState().selectedPost.likes).toBe(5);
    expect(usePostStore.getState().selectedPost.saves).toBe(7);
    expect(usePostStore.getState().selectedPost.comments).toBe(4);
  });

  it('removes deleted comment with its replies and decrements count by the whole subtree once', async () => {
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            ownerUserId: 'user-2',
            content: 'existing',
            replies: [
              {
                id: 'reply-1',
                ownerUserId: 'user-3',
                content: 'reply one',
              },
              {
                id: 'reply-2',
                ownerUserId: 'user-4',
                content: 'reply two',
              },
            ],
          },
        ],
      },
    });
    usePostStore.setState({
      selectedPost: {
        id: 'post-1',
        ownerUserId: 'user-1',
        title: 'Detail post',
        tags: ['树洞'],
        comments: 3,
      },
      posts: [
        {
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Detail post',
          tags: ['树洞'],
          comments: 3,
        },
      ],
      getPostLikeView: (post) => post,
    });

    render(<App />);

    const es = MockEventSource.instances[0];
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 0,
    });
    es.emit('comment-deleted', {
      postId: 'post-1',
      commentId: 'comment-1',
      deletedReplyCount: 2,
    });
    es.emit('post-stats-updated', {
      postId: 'post-1',
      comments: 0,
    });
    es.emit('comment-deleted', {
      postId: 'post-1',
      commentId: 'comment-1',
      deletedReplyCount: 2,
    });

    await waitFor(() => {
      expect(useCommentStore.getState().commentsMap['post-1']).toHaveLength(0);
    });

    expect(usePostStore.getState().posts[0].comments).toBe(0);
    expect(screen.getByTestId('detail-comment-count')).toHaveTextContent('0');
  });
});
