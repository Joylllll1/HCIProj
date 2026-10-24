import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BookmarksPage from './BookmarksPage';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import { fetchSavedPosts } from '../../services/postService';

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
    fetchSavedPosts.mockResolvedValue([]);
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

  it('keeps expanded results when the background saved-post request finishes', async () => {
    let resolveSaved;
    fetchSavedPosts.mockImplementationOnce(() => new Promise((resolve) => { resolveSaved = resolve; }));
    render(
      <BookmarksPage
        posts={savedPosts}
        bookmarks={savedPosts.map((post) => post.id)}
        collectionFolders={[{ id: 'all', name: '全部', isDefault: true }]}
        bookmarkFolders={{}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(screen.getByText('Saved post 25')).toBeInTheDocument();

    await act(async () => { resolveSaved(savedPosts); });
    expect(screen.getByText('Saved post 25')).toBeInTheDocument();
  });
});

describe('BookmarksPage folder management', () => {
  const baseProps = {
    posts: [],
    bookmarks: [],
    onOpenPost: vi.fn(),
    onLike: vi.fn(),
    onBookmark: vi.fn(),
    onReport: vi.fn(),
    collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
    bookmarkFolders: {},
    onCreateFolder: vi.fn().mockResolvedValue(undefined),
    onRenameFolder: vi.fn().mockResolvedValue(undefined),
    onDeleteFolder: vi.fn().mockResolvedValue(undefined),
  };

  const renderPage = (overrides = {}) => render(<BookmarksPage {...baseProps} {...overrides} />);

  beforeEach(() => {
    vi.clearAllMocks();
    usePostStore.setState(usePostStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);
    useUiStore.setState({ query: '', bookmarkFolder: 'all', showToast: vi.fn() });
    usePostStore.setState({ getPostLikeView: (post) => post });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the create-folder action discoverable in compact personal space', () => {
    renderPage({ compact: true });

    fireEvent.click(screen.getByRole('button', { name: '新建收藏夹' }));

    expect(screen.getByRole('dialog', { name: '新建收藏夹' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '新建收藏夹' })).toBeInTheDocument();
  });

  it('ignores IME and blank Enter, then prevents duplicate create requests and dismissal while pending', async () => {
    let resolveCreate;
    const onCreateFolder = vi.fn(() => new Promise((resolve) => { resolveCreate = resolve; }));
    renderPage({ compact: true, onCreateFolder });

    fireEvent.click(screen.getByRole('button', { name: '新建收藏夹' }));
    const input = screen.getByRole('textbox', { name: '收藏夹名称' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateFolder).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '课程资料' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onCreateFolder).toHaveBeenCalledTimes(1);
    expect(onCreateFolder).toHaveBeenCalledWith('课程资料');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '创建中…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();

    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog', { name: '新建收藏夹' }).parentElement);
    expect(screen.getByRole('dialog', { name: '新建收藏夹' })).toBeInTheDocument();

    await act(async () => { resolveCreate(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建收藏夹' })).not.toBeInTheDocument());
  });

  it('keeps failed create input visible and offers an in-place retry', async () => {
    const onCreateFolder = vi.fn()
      .mockRejectedValueOnce(new Error('名称已存在'))
      .mockResolvedValueOnce(undefined);
    renderPage({ compact: true, onCreateFolder });

    fireEvent.click(screen.getByRole('button', { name: '新建收藏夹' }));
    const input = screen.getByRole('textbox', { name: '收藏夹名称' });
    fireEvent.change(input, { target: { value: '课程资料' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('名称已存在');
    expect(input).toHaveValue('课程资料');
    fireEvent.click(screen.getByRole('button', { name: '重试创建' }));
    await waitFor(() => expect(onCreateFolder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建收藏夹' })).not.toBeInTheDocument());
  });

  it('guards rename submissions and retains the editor until the request succeeds', async () => {
    let rejectRename;
    const onRenameFolder = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRename = reject; }))
      .mockResolvedValueOnce(undefined);
    const folder = { id: 'course', name: '课程资料', isDefault: false };
    renderPage({
      collectionFolders: [...baseProps.collectionFolders, folder],
      onRenameFolder,
    });

    fireEvent.click(screen.getByRole('button', { name: '更多收藏夹操作：课程资料' }));
    fireEvent.click(screen.getByRole('button', { name: '重命名' }));
    const input = screen.getByRole('textbox', { name: '新的收藏夹名称' });
    fireEvent.change(input, { target: { value: '课程与活动' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onRenameFolder).toHaveBeenCalledTimes(1);
    expect(onRenameFolder).toHaveBeenCalledWith('course', '课程与活动');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '重命名收藏夹' })).toBeInTheDocument();

    await act(async () => { rejectRename(new Error('名称冲突')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('名称冲突');
    expect(input).toHaveValue('课程与活动');
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));
    await waitFor(() => expect(onRenameFolder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '重命名收藏夹' })).not.toBeInTheDocument());
  });

  it('lets the user cancel deletion, then shows a folder-specific failure and retries in place', async () => {
    const folder = { id: 'course', name: '课程资料 & 活动', isDefault: false };
    let rejectDelete;
    const onDeleteFolder = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectDelete = reject; }))
      .mockResolvedValueOnce(undefined);
    renderPage({
      collectionFolders: [...baseProps.collectionFolders, folder],
      bookmarks: ['post-1', 'post-2'],
      bookmarkFolders: { course: ['post-1', 'post-2'] },
      onDeleteFolder,
    });
    useUiStore.setState({ bookmarkFolder: 'course' });

    const openFolderActions = () => fireEvent.click(screen.getByRole('button', { name: '更多收藏夹操作：课程资料 & 活动' }));
    const openDeleteDialog = () => {
      openFolderActions();
      fireEvent.click(within(screen.getByRole('group', { name: '课程资料 & 活动收藏夹操作' })).getByRole('button', { name: '删除' }));
    };

    openDeleteDialog();
    expect(screen.getByRole('heading', { name: '删除收藏夹？' })).toBeInTheDocument();
    expect(screen.getByText('“课程资料 & 活动”中的 2 条收藏会移至“全部”，帖子不会从收藏中移除。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保留收藏夹' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDeleteFolder).not.toHaveBeenCalled();

    openDeleteDialog();
    const confirmButton = screen.getByRole('button', { name: '删除收藏夹' });
    act(() => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
    });
    expect(onDeleteFolder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '保留收藏夹' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => { rejectDelete(new Error('网络中断')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('网络中断');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试删除' }));

    await waitFor(() => expect(onDeleteFolder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useUiStore.getState().bookmarkFolder).toBe('all');
  });

  it('supports keyboard focus, Escape restoration, and outside dismissal for folder actions', () => {
    const folder = { id: 'course', name: '课程资料', isDefault: false };
    renderPage({ collectionFolders: [...baseProps.collectionFolders, folder] });

    const trigger = screen.getByRole('button', { name: '更多收藏夹操作：课程资料' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls');
    const firstAction = screen.getByRole('button', { name: '重命名' });
    expect(firstAction).toHaveFocus();
    fireEvent.keyDown(firstAction, { key: 'Escape' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    act(() => screen.getByRole('button', { name: '新建收藏夹' }).focus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: '新建收藏夹' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
