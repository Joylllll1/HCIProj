import { beforeEach, describe, expect, it, vi } from 'vitest';
import useBookmarkStore from './bookmarkStore';

const fetchBookmarksMock = vi.fn();
const migrateLegacyBookmarksMock = vi.fn();
const createBookmarkFolderMock = vi.fn();
const renameBookmarkFolderMock = vi.fn();
const deleteBookmarkFolderMock = vi.fn();
const saveBookmarkMock = vi.fn();
const removeBookmarkMock = vi.fn();

vi.mock('../services/bookmarkService', () => ({
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
