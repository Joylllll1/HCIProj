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
  default: ({ post, onBookmark }) => <div>{post.title}<button type="button" onClick={onBookmark} aria-label={`取消收藏：${post.title}`}>取消收藏</button></div>,
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
    fetchSavedPosts.mockResolvedValue(savedPosts);
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

    await screen.findByText('Saved post 20');
    expect(screen.queryByText('Saved post 21')).not.toBeInTheDocument();
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


describe('BookmarksPage batch management', () => {
  const posts = Array.from({ length: 105 }, (_, index) => ({ id: `p${index}`, title: `收藏 ${index}`, content: '选课经验', tags: ['选课'] }));
  const folders = [{ id: 'all', name: '全部', isDefault: true }, { id: 'a', name: '课程' }, { id: 'b', name: '生活' }];
  const props = (extra = {}) => ({
    accountKey: 'actor', bookmarks: posts.slice(0, 25).map((post) => post.id),
    collectionFolders: folders, bookmarkFolders: { a: posts.slice(0, 25).map((post) => post.id) },
    onOpenPost: vi.fn(), onLike: vi.fn(), onBookmark: vi.fn(), onCreateFolder: vi.fn(),
    onMoveBookmarks: vi.fn().mockResolvedValue({ results: [{ postId: 'p0', status: 'moved' }] }),
    onRemoveBookmarks: vi.fn().mockResolvedValue({ results: [{ postId: 'p0', status: 'removed' }] }), ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSavedPosts.mockResolvedValue(posts);
    useUiStore.setState({ query: '', bookmarkFolder: 'all', showToast: vi.fn() });
    usePostStore.setState(usePostStore.getInitialState(), true);
    usePostStore.setState({ getPostLikeView: (post) => post });
  });
  afterEach(cleanup);

  const enter = async () => {
    const button = screen.getByRole('button', { name: '批量管理' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
  };

  it('confirms individual bookmark removal, allows cancellation and sends only the confirmed post', async () => {
    const options = props();
    render(<BookmarksPage {...options} />);
    await screen.findByRole('button', { name: '取消收藏：收藏 0' });
    fireEvent.click(screen.getByRole('button', { name: '取消收藏：收藏 0' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('取消收藏 1 篇？');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('原帖仍保留');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('收藏 0');
    expect(options.onRemoveBookmarks).not.toHaveBeenCalled();
    expect(options.onBookmark).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(options.onRemoveBookmarks).toHaveBeenCalledWith(['p0']);
    expect(options.onRemoveBookmarks).toHaveBeenCalledTimes(1);
  });

  it('keeps single removal confirmation open on failure and supports retry', async () => {
    const options = props({ onRemoveBookmarks: vi.fn().mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce({ results: [{ postId: 'p0', status: 'removed' }] }) });
    render(<BookmarksPage {...options} />);
    fireEvent.click(await screen.findByRole('button', { name: '取消收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('dialog')).toHaveTextContent('网络中断');
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(options.onRemoveBookmarks).toHaveBeenCalledTimes(2);
  });

  it('selects only displayed posts, leaves new pages unselected and clears on folder/query change', async () => {
    render(<BookmarksPage {...props()} />);
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(screen.getByText('已选 20 篇')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 24' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '全选' }).indeterminate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^课程\(25\)$/ }));
    expect(screen.getByText('已选 0 篇')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    act(() => useUiStore.setState({ query: '选课' }));
    expect(screen.getByText('已选 0 篇')).toBeInTheDocument();
  });

  it('moves one item only after explicit submission and keeps management open', async () => {
    const options = props({ compact: true });
    render(<BookmarksPage {...options} />);
    expect(screen.getByRole('button', { name: /新建收藏夹/ })).toBeInTheDocument();
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    expect(options.onOpenPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '移动到' }));
    fireEvent.click(screen.getByRole('radio', { name: '生活' }));
    expect(options.onMoveBookmarks).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '移动 1 篇' }));
    await screen.findByText('已移动 1 篇');
    expect(options.onMoveBookmarks).toHaveBeenCalledWith(['p0'], 'b');
    expect(screen.getByText('已选 0 篇')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '完成' })).toBeInTheDocument();
  });

  it('opens folder choices in a dialog and cancelling retains the selection without moving', async () => {
    const options = props();
    render(<BookmarksPage {...options} />);
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('button', { name: '移动到' }));
    expect(screen.getByRole('dialog', { name: '移动收藏' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '生活' }));
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' })).toBeChecked();
    expect(options.onMoveBookmarks).not.toHaveBeenCalled();
  });

  it('supports moving to all, disables the current custom folder and preserves failed selections', async () => {
    const options = props({ onMoveBookmarks: vi.fn().mockResolvedValue({ results: [{ postId: 'p0', status: 'failed' }, { postId: 'p1', status: 'moved' }] }) });
    render(<BookmarksPage {...options} />);
    await enter();
    fireEvent.click(screen.getByRole('button', { name: /^课程\(25\)$/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 1' }));
    fireEvent.click(screen.getByRole('button', { name: '移动到' }));
    expect(screen.getByRole('radio', { name: '课程（当前）' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '全部' }));
    expect(screen.getByText('移出自定义收藏夹，仍保留收藏。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '移动 2 篇' }));
    await screen.findByText('已移动 1 篇，1 篇失败，请重试');
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 1' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
  });

  it('shows a concise batch confirmation, supports cancellation, and suppresses duplicate submissions', async () => {
    let resolve;
    const options = props({ onRemoveBookmarks: vi.fn().mockReturnValue(new Promise((done) => { resolve = done; })) });
    render(<BookmarksPage {...options} />);
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 1' }));
    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('取消收藏 2 篇？');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('收藏 0');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('原帖仍保留');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(options.onRemoveBookmarks).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));
    fireEvent.click(screen.getByRole('button', { name: '正在取消…' }));
    expect(options.onRemoveBookmarks).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ results: [{ postId: 'p0', status: 'removed' }, { postId: 'p1', status: 'removed' }] }));
    expect(screen.getByText('已取消收藏 2 篇')).toBeInTheDocument();
  });

  it('keeps failed removals selected while a partial-success refresh is pending', async () => {
    let resolveRefresh;
    fetchSavedPosts
      .mockImplementationOnce(() => Promise.resolve(posts))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    let updateBookmarks;
    const options = props({
      accountKey: 'user-1',
      onRemoveBookmarks: vi.fn(async () => {
        updateBookmarks(['p1', ...posts.slice(2, 25).map((post) => post.id)]);
        return { results: [{ postId: 'p0', status: 'removed' }, { postId: 'p1', status: 'failed' }] };
      }),
    });
    const view = render(<BookmarksPage {...options} />);
    updateBookmarks = (bookmarks) => view.rerender(<BookmarksPage {...options} bookmarks={bookmarks} />);

    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 1' }));
    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));

    await screen.findByText('已取消收藏 1 篇，1 篇失败，请重试');
    expect(fetchSavedPosts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 1' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消' }));
    expect(options.onRemoveBookmarks).toHaveBeenNthCalledWith(2, ['p1']);

    await act(async () => { resolveRefresh(posts.slice(1)); });
  });

  it('retains selection and target after a failure', async () => {
    render(<BookmarksPage {...props({ onMoveBookmarks: vi.fn().mockRejectedValue(new Error('网络中断')) })} />);
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('button', { name: '移动到' }));
    fireEvent.click(screen.getByRole('radio', { name: '生活' }));
    fireEvent.click(screen.getByRole('button', { name: '移动 1 篇' }));
    await screen.findByText('网络中断');
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '生活' })).toBeChecked();
  });

  it('limits selection to 100 and prunes deleted posts', async () => {
    render(<BookmarksPage {...props({ bookmarks: posts.map((post) => post.id) })} />);
    await enter();
    for (let index = 0; index < 5; index += 1) fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(screen.getByText('已选 100 篇')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '选择收藏：收藏 100' })).toBeDisabled();
    act(() => usePostStore.getState().removePostById('p0'));
    expect(screen.getByText('已选 99 篇')).toBeInTheDocument();
  });

  it('ignores a late result after changing search away and back to the same text', async () => {
    let resolve;
    const options = props({ onMoveBookmarks: vi.fn().mockReturnValue(new Promise((done) => { resolve = done; })) });
    render(<BookmarksPage {...options} />);
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: '选择收藏：收藏 0' }));
    fireEvent.click(screen.getByRole('button', { name: '移动到' }));
    fireEvent.click(screen.getByRole('radio', { name: '生活' }));
    fireEvent.click(screen.getByRole('button', { name: '移动 1 篇' }));
    act(() => useUiStore.setState({ query: '其他' }));
    act(() => useUiStore.setState({ query: '' }));
    await act(async () => resolve({ results: [{ postId: 'p0', status: 'failed' }] }));
    expect(screen.getByText('已选 0 篇')).toBeInTheDocument();
    expect(screen.queryByText('1 篇失败，请重试')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not enter management when the authoritative saved list fails', async () => {
    fetchSavedPosts.mockRejectedValueOnce(new Error('加载失败'));
    render(<BookmarksPage {...props()} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '批量管理' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });
});
