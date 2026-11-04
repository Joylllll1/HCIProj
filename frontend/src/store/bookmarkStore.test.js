import { beforeEach, describe, expect, it, vi } from 'vitest';
import useBookmarkStore from './bookmarkStore';
import useAuthStore from './authStore';
import usePostStore from './postStore';
import { fetchPostById } from '../services/postService';

vi.mock('../services/postService', () => ({ fetchPostById: vi.fn() }));

const moveBookmarksMock = vi.fn();
const removeBookmarksMock = vi.fn();

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fetchBookmarksMock = vi.fn();
const migrateLegacyBookmarksMock = vi.fn();
const createBookmarkFolderMock = vi.fn();
const renameBookmarkFolderMock = vi.fn();
const deleteBookmarkFolderMock = vi.fn();
const saveBookmarkMock = vi.fn();
const removeBookmarkMock = vi.fn();

vi.mock('../services/bookmarkService', () => ({
  moveBookmarks: (...args) => moveBookmarksMock(...args),
  removeBookmarks: (...args) => removeBookmarksMock(...args),
  fetchBookmarks: (...args) => fetchBookmarksMock(...args),
  migrateLegacyBookmarks: (...args) => migrateLegacyBookmarksMock(...args),
  createBookmarkFolder: (...args) => createBookmarkFolderMock(...args),
  renameBookmarkFolder: (...args) => renameBookmarkFolderMock(...args),
  deleteBookmarkFolder: (...args) => deleteBookmarkFolderMock(...args),
  saveBookmark: (...args) => saveBookmarkMock(...args),
  removeBookmark: (...args) => removeBookmarkMock(...args),
}));

describe('bookmarkStore hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: null });
    useBookmarkStore.setState(useBookmarkStore.getInitialState(), true);
  });

  it('loads bookmark state from the server', async () => {
    fetchBookmarksMock.mockResolvedValueOnce({
      bookmarks: ['post-1'],
      collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
      bookmarkFolders: {},
    });

    await useBookmarkStore.getState().loadBookmarks();

    expect(useBookmarkStore.getState().bookmarks).toEqual(['post-1']);
    expect(useBookmarkStore.getState().collectionFolders).toEqual([
      { id: 'all', name: '全部', isDefault: true },
    ]);
    expect(useBookmarkStore.getState().initialized).toBe(true);
  });

  it('clears bookmark state and ignores a pending load from the previous account', async () => {
    const request = createDeferred();
    fetchBookmarksMock.mockReturnValueOnce(request.promise);
    const pendingLoad = useBookmarkStore.getState().loadBookmarks();

    useBookmarkStore.getState().resetForAccountChange();
    request.resolve({
      bookmarks: ['old-user-post'],
      collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
      bookmarkFolders: {},
    });
    await pendingLoad;

    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    expect(useBookmarkStore.getState().bookmarkFolders).toEqual({});
    expect(useBookmarkStore.getState().loading).toBe(false);
    expect(useBookmarkStore.getState().initialized).toBe(false);
  });

  it('migrates legacy local bookmark metadata once after loading from the server', async () => {
    localStorage.setItem('nju_bookmarks', JSON.stringify(['post-2']));
    localStorage.setItem('nju_collection_folders', JSON.stringify([
      { id: 'all', name: '全部', isDefault: true },
      { id: 'folder-1', name: '旧文件夹', isDefault: false },
    ]));
    localStorage.setItem('nju_bookmark_folders', JSON.stringify({
      'folder-1': ['post-2'],
    }));

    fetchBookmarksMock.mockResolvedValueOnce({
      bookmarks: [],
      collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
      bookmarkFolders: {},
    });
    migrateLegacyBookmarksMock.mockResolvedValueOnce({
      bookmarks: ['post-2'],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
        { id: 'folder-1', name: '旧文件夹', isDefault: false },
      ],
      bookmarkFolders: {
        'folder-1': ['post-2'],
      },
    });

    await useBookmarkStore.getState().loadBookmarks();

    expect(migrateLegacyBookmarksMock).toHaveBeenCalledWith({
      bookmarks: ['post-2'],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
        { id: 'folder-1', name: '旧文件夹', isDefault: false },
      ],
      bookmarkFolders: {
        'folder-1': ['post-2'],
      },
    });
    expect(useBookmarkStore.getState().bookmarks).toEqual(['post-2']);
    expect(localStorage.getItem('nju_bookmarks_server_migrated_v1')).toBe('true');
  });

  it('keeps legacy migration available after visiting the same-origin demo', async () => {
    const originalUrl = window.location.href;
    localStorage.setItem('nju_bookmarks', JSON.stringify(['legacy']));
    fetchBookmarksMock.mockResolvedValue({ version: 0, bookmarks: [] });
    migrateLegacyBookmarksMock.mockResolvedValue({ version: 1, bookmarks: ['legacy'] });
    try {
      window.history.replaceState({}, '', '/?preview=1');
      await useBookmarkStore.getState().loadBookmarks();
      expect(migrateLegacyBookmarksMock).not.toHaveBeenCalled();
      expect(localStorage.getItem('nju_bookmarks_server_migrated_v1')).toBeNull();
      window.history.replaceState({}, '', '/');
      await useBookmarkStore.getState().loadBookmarks();
      expect(migrateLegacyBookmarksMock).toHaveBeenCalledWith(expect.objectContaining({ bookmarks: ['legacy'] }));
      expect(useBookmarkStore.getState().bookmarks).toEqual(['legacy']);
    } finally {
      window.history.replaceState({}, '', originalUrl);
    }
  });

  it('creates, renames, and deletes bookmark folders from the server state', async () => {
    createBookmarkFolderMock.mockResolvedValueOnce({
      bookmarks: [],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
        { id: 'folder-1', name: '新文件夹', isDefault: false },
      ],
      bookmarkFolders: {},
    });
    renameBookmarkFolderMock.mockResolvedValueOnce({
      bookmarks: [],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
        { id: 'folder-1', name: '已重命名', isDefault: false },
      ],
      bookmarkFolders: {},
    });
    deleteBookmarkFolderMock.mockResolvedValueOnce({
      bookmarks: [],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
      ],
      bookmarkFolders: {},
    });

    await useBookmarkStore.getState().createFolder('新文件夹');
    expect(createBookmarkFolderMock).toHaveBeenCalledWith('新文件夹');
    expect(useBookmarkStore.getState().collectionFolders).toEqual([
      { id: 'all', name: '全部', isDefault: true },
      { id: 'folder-1', name: '新文件夹', isDefault: false },
    ]);

    await useBookmarkStore.getState().renameFolder('folder-1', '已重命名');
    expect(renameBookmarkFolderMock).toHaveBeenCalledWith('folder-1', '已重命名');
    expect(useBookmarkStore.getState().collectionFolders).toEqual([
      { id: 'all', name: '全部', isDefault: true },
      { id: 'folder-1', name: '已重命名', isDefault: false },
    ]);

    await useBookmarkStore.getState().deleteFolder('folder-1');
    expect(deleteBookmarkFolderMock).toHaveBeenCalledWith('folder-1');
    expect(useBookmarkStore.getState().collectionFolders).toEqual([
      { id: 'all', name: '全部', isDefault: true },
    ]);
  });

  it('saves a pending bookmark into the selected folder and syncs server state', async () => {
    saveBookmarkMock.mockResolvedValueOnce({
      bookmarks: ['post-3'],
      collectionFolders: [
        { id: 'all', name: '全部', isDefault: true },
        { id: 'folder-2', name: '收藏夹', isDefault: false },
      ],
      bookmarkFolders: {
        'folder-2': ['post-3'],
      },
    });

    useBookmarkStore.setState({
      pendingBookmarkItem: { id: 'post-3', type: 'post' },
      folderSelectorOpen: true,
    });

    const result = await useBookmarkStore.getState().selectFolder('folder-2');

    expect(saveBookmarkMock).toHaveBeenCalledWith('post-3', 'folder-2');
    expect(result).toEqual({
      status: 'added',
      data: {
        bookmarks: ['post-3'],
        collectionFolders: [
          { id: 'all', name: '全部', isDefault: true },
          { id: 'folder-2', name: '收藏夹', isDefault: false },
        ],
        bookmarkFolders: {
          'folder-2': ['post-3'],
        },
      },
    });
    expect(useBookmarkStore.getState().bookmarks).toEqual(['post-3']);
    expect(useBookmarkStore.getState().folderSelectorOpen).toBe(false);
    expect(useBookmarkStore.getState().pendingBookmarkItem).toBeNull();
  });

  it('removes an existing bookmark using the server response', async () => {
    removeBookmarkMock.mockResolvedValueOnce({
      bookmarks: [],
      collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
      bookmarkFolders: {},
    });

    useBookmarkStore.setState({
      bookmarks: ['post-4'],
      collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
      bookmarkFolders: {},
    });

    const result = await useBookmarkStore.getState().toggleBookmark('post-4');

    expect(removeBookmarkMock).toHaveBeenCalledWith('post-4');
    expect(result).toEqual({
      status: 'removed',
      data: {
        bookmarks: [],
        collectionFolders: [{ id: 'all', name: '全部', isDefault: true }],
        bookmarkFolders: {},
      },
    });
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});


describe('bookmarkStore batch ownership and versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('nju_bookmarks_server_migrated_v1', 'true');
    useAuthStore.setState({ user: { _id: 'actor' } });
    useBookmarkStore.setState(useBookmarkStore.getInitialState(), true);
    usePostStore.setState(usePostStore.getInitialState(), true);
  });

  it('sends the current version and synchronizes cancelled posts across pages', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    removeBookmarksMock.mockResolvedValueOnce({ version: 8, bookmarks: [], postStates: [{ postId: 'p', isSaved: false, saves: 2 }] });
    await useBookmarkStore.getState().removeBookmarks(['p']);
    expect(removeBookmarksMock).toHaveBeenCalledWith(['p'], 7);
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: false, saves: 2 });
    expect(useBookmarkStore.getState().version).toBe(8);
  });

  it('does not change post counts when moving and rejects older snapshots', async () => {
    useBookmarkStore.setState({ version: 3, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 4, isSaved: true }] });
    moveBookmarksMock.mockResolvedValueOnce({ version: 4, bookmarks: ['p'], bookmarkFolders: { b: ['p'] } });
    await useBookmarkStore.getState().moveBookmarks(['p'], 'b');
    expect(moveBookmarksMock).toHaveBeenCalledWith(['p'], 'b', 3);
    useBookmarkStore.getState().applyBookmarkState({ version: 2, bookmarks: [] });
    expect(useBookmarkStore.getState().bookmarks).toEqual(['p']);
    expect(usePostStore.getState().posts[0].saves).toBe(4);
  });

  it('keeps membership current when a newer folder response arrives before removal', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    const post = { id: 'p', saves: 3, isSaved: true };
    usePostStore.setState({ posts: [post], myPosts: [post], selectedPost: post });
    const removal = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    createBookmarkFolderMock.mockResolvedValueOnce({ version: 9, bookmarks: [] });
    await useBookmarkStore.getState().createFolder('新收藏夹');
    fetchPostById.mockResolvedValueOnce({ saves: 2 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', isSaved: false, saves: 2 }] });
    await pending;
    expect(useBookmarkStore.getState().version).toBe(9);
    const state = usePostStore.getState();
    for (const item of [state.posts[0], state.myPosts[0], state.selectedPost]) {
      expect(item).toMatchObject({ isSaved: false, saves: 2 });
    }
  });

  it('re-reads counts when SSE overlaps a batch response and preserves later SSE', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    const refresh = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockReturnValueOnce(refresh.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 2 });
    usePostStore.getState().applyRealtimePostStats('p', { saves: 3 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await vi.waitFor(() => expect(fetchPostById).toHaveBeenCalledWith('p'));
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: false, saves: 3 });
    usePostStore.getState().applyRealtimePostStats('p', { saves: 4 });
    refresh.resolve({ saves: 3 });
    await pending;
    expect(usePostStore.getState().posts[0].saves).toBe(4);
  });

  it('uses a fresh count when the overlapping SSE preceded the removal', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockResolvedValueOnce({ saves: 3 });
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 4 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 3 }] });
    await pending;
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: false, saves: 3 });
  });

  it('does not undo a newer re-save when an older removal response arrives', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    useBookmarkStore.getState().applyBookmarkState({ version: 9, bookmarks: ['p'] });
    fetchPostById.mockResolvedValueOnce({ saves: 3 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', isSaved: false, saves: 2 }] });
    await pending;
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: true, saves: 3 });
  });

  it('completes removal before the background count read and accepts it after unchanged stats are copied', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    const refresh = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockReturnValueOnce(refresh.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 3 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await pending;
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    usePostStore.getState().setSelectedPost({ id: 'p', saves: 3, likes: 5 });
    refresh.resolve({ saves: 2 });
    await vi.waitFor(() => expect(usePostStore.getState().posts[0].saves).toBe(2));
  });

  it('preserves a newer SSE observation even when its count matches the cache', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    const removal = createDeferred();
    const refresh = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockReturnValueOnce(refresh.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 3 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await pending;
    usePostStore.getState().applyRealtimePostStats('p', { saves: 3 });
    refresh.resolve({ saves: 2 });
    await refresh.promise;
    expect(usePostStore.getState().postStatsById.p.saves).toBe(3);
  });

  it('lets the latest count read win when stale mutation responses overlap', async () => {
    const firstRead = createDeferred();
    const secondRead = createDeferred();
    fetchPostById.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise);
    useBookmarkStore.getState().applyBookmarkState({ version: 9, bookmarks: [] });
    removeBookmarksMock.mockResolvedValueOnce({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await useBookmarkStore.getState().removeBookmarks(['p']);
    useBookmarkStore.getState().applyBookmarkState({ version: 11, bookmarks: ['p'] });
    useBookmarkStore.setState({ pendingBookmarkItem: { id: 'p' } });
    saveBookmarkMock.mockResolvedValueOnce({ version: 10, bookmarks: ['p'], saves: 3 });
    await useBookmarkStore.getState().selectFolder('all');
    firstRead.resolve({ saves: 2 });
    await firstRead.promise;
    secondRead.resolve({ saves: 3 });
    await secondRead.promise;
    expect(usePostStore.getState().postStatsById.p.saves).toBe(3);
  });

  it('skips count reads when the response agrees with SSE', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    const removal = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 2 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await pending;
    expect(fetchPostById).not.toHaveBeenCalled();
  });

  it('preserves observed counts when reconciliation fails', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockRejectedValueOnce(new Error('offline'));
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 4 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await pending;
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: false, saves: 4 });
  });

  it('discards a count refresh after switching accounts', async () => {
    useBookmarkStore.setState({ version: 7, bookmarks: ['p'] });
    usePostStore.setState({ posts: [{ id: 'p', saves: 3, isSaved: true }] });
    const removal = createDeferred();
    const refresh = createDeferred();
    removeBookmarksMock.mockReturnValueOnce(removal.promise);
    fetchPostById.mockReturnValueOnce(refresh.promise);
    const pending = useBookmarkStore.getState().removeBookmarks(['p']);
    usePostStore.getState().applyRealtimePostStats('p', { saves: 4 });
    removal.resolve({ version: 8, bookmarks: [], postStates: [{ postId: 'p', saves: 2 }] });
    await vi.waitFor(() => expect(fetchPostById).toHaveBeenCalledWith('p'));
    useAuthStore.setState({ user: { _id: 'another' } });
    useBookmarkStore.getState().reset();
    usePostStore.setState({ posts: [{ id: 'p', saves: 8, isSaved: true }] });
    refresh.resolve({ saves: 2 });
    await pending;
    await refresh.promise;
    expect(usePostStore.getState().posts[0]).toMatchObject({ isSaved: true, saves: 8 });
  });

  it('ignores a previous account response including its post state', async () => {
    let resolve;
    removeBookmarksMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const request = useBookmarkStore.getState().removeBookmarks(['p']);
    useAuthStore.setState({ user: { _id: 'another' } });
    useBookmarkStore.getState().reset();
    useBookmarkStore.setState({ bookmarks: ['new'] });
    resolve({ version: 50, bookmarks: [], postStates: [{ postId: 'p', isSaved: false, saves: 0 }] });
    await expect(request).rejects.toThrow('账号已切换');
    expect(useBookmarkStore.getState().bookmarks).toEqual(['new']);
  });

  it('refreshes on 409 and requires an explicit retry', async () => {
    moveBookmarksMock.mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }));
    fetchBookmarksMock.mockResolvedValueOnce({ version: 9, bookmarks: ['p'] });
    await expect(useBookmarkStore.getState().moveBookmarks(['p'], 'b')).rejects.toThrow('conflict');
    expect(moveBookmarksMock).toHaveBeenCalledTimes(1);
    expect(useBookmarkStore.getState().version).toBe(9);
  });

  it('ignores a late hydration after reset, even when the same account returns', async () => {
    let resolve;
    fetchBookmarksMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const request = useBookmarkStore.getState().loadBookmarks();
    useBookmarkStore.getState().reset();
    resolve({ version: 10, bookmarks: ['old'] });
    await request;
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});
