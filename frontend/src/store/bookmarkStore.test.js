import { beforeEach, describe, expect, it, vi } from 'vitest';
import useBookmarkStore from './bookmarkStore';
import useAuthStore from './authStore';
import usePostStore from './postStore';

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
