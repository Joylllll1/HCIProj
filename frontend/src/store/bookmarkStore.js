import { create } from 'zustand';
import * as bookmarkService from '../services/bookmarkService';
import { loadJSON } from '../utils';

const DEFAULT_FOLDERS = [{ id: 'all', name: '全部', isDefault: true }];
const LEGACY_MIGRATION_KEY = 'nju_bookmarks_server_migrated_v1';
let accountGeneration = 0;

function sanitizeBookmarkPayload(data = {}) {
  return {
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
    collectionFolders: Array.isArray(data.collectionFolders) && data.collectionFolders.length > 0
      ? data.collectionFolders
      : DEFAULT_FOLDERS,
    bookmarkFolders: data.bookmarkFolders && typeof data.bookmarkFolders === 'object'
      ? data.bookmarkFolders
      : {},
  };
}

function getLegacyPayload() {
  return {
    bookmarks: loadJSON('nju_bookmarks', []),
    collectionFolders: loadJSON('nju_collection_folders', DEFAULT_FOLDERS),
    bookmarkFolders: loadJSON('nju_bookmark_folders', {}),
  };
}

function hasLegacyBookmarkData(payload) {
  return (
    (Array.isArray(payload.bookmarks) && payload.bookmarks.length > 0) ||
    (Array.isArray(payload.collectionFolders) && payload.collectionFolders.some((folder) => folder?.id !== 'all')) ||
    (payload.bookmarkFolders && Object.keys(payload.bookmarkFolders).length > 0)
  );
}

function markLegacyMigrated() {
  try {
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'true');
  } catch {
    // ignore
  }
}

function hasMigratedLegacyBookmarks() {
  try {
    return localStorage.getItem(LEGACY_MIGRATION_KEY) === 'true';
  } catch {
    return true;
  }
}

function buildInitialState() {
  return {
    bookmarks: [],
    collectionFolders: DEFAULT_FOLDERS,
    bookmarkFolders: {},
    folderSelectorOpen: false,
    pendingBookmarkItem: null,
    loading: false,
    initialized: false,
  };
}

const useBookmarkStore = create((set, get) => ({
  ...buildInitialState(),

  applyBookmarkState: (data) => {
    const next = sanitizeBookmarkPayload(data);
    set({
      ...next,
      loading: false,
      initialized: true,
    });
    return next;
  },

  resetForAccountChange: () => {
    accountGeneration += 1;
    set(buildInitialState());
  },

  loadBookmarks: async () => {
    const requestGeneration = accountGeneration;
    set({ loading: true });
    try {
      const data = await bookmarkService.fetchBookmarks();
      if (requestGeneration !== accountGeneration) return null;
      let next = get().applyBookmarkState(data);

      if (!hasMigratedLegacyBookmarks()) {
        const legacyPayload = getLegacyPayload();
        if (hasLegacyBookmarkData(legacyPayload)) {
          const migrated = await bookmarkService.migrateLegacyBookmarks(legacyPayload);
          if (requestGeneration !== accountGeneration) return null;
          next = get().applyBookmarkState(migrated);
        }
        markLegacyMigrated();
      }

      return next;
    } catch (error) {
      if (requestGeneration !== accountGeneration) return null;
      set({ loading: false, initialized: true });
      throw error;
    }
  },

  toggleBookmark: async (itemId) => {
    if (get().bookmarks.includes(itemId)) {
      const requestGeneration = accountGeneration;
      const data = await bookmarkService.removeBookmark(itemId);
      if (requestGeneration !== accountGeneration) return null;
      get().applyBookmarkState(data);
      return { status: 'removed', data };
    }

    set({
      pendingBookmarkItem: { id: itemId, type: 'post' },
      folderSelectorOpen: true,
    });
    return { status: 'selecting_folder' };
  },

  removePostReferences: (postId) => {
    set((state) => ({
      bookmarks: state.bookmarks.filter((id) => id !== postId),
      bookmarkFolders: Object.fromEntries(
        Object.entries(state.bookmarkFolders).flatMap(([folderId, postIds]) => {
          const remainingIds = postIds.filter((id) => id !== postId);
          return remainingIds.length > 0 ? [[folderId, remainingIds]] : [];
        }),
      ),
      ...(state.pendingBookmarkItem?.id === postId
        ? { folderSelectorOpen: false, pendingBookmarkItem: null }
        : {}),
    }));
  },

  selectFolder: async (folderId) => {
    const pendingItem = get().pendingBookmarkItem;
    if (!pendingItem?.id) return null;

    const requestGeneration = accountGeneration;
    const data = await bookmarkService.saveBookmark(pendingItem.id, folderId);
    if (requestGeneration !== accountGeneration) return null;
    get().applyBookmarkState(data);
    set({
      folderSelectorOpen: false,
      pendingBookmarkItem: null,
    });
    return { status: 'added', data };
  },

  closeFolderSelector: () => {
    set({ folderSelectorOpen: false, pendingBookmarkItem: null });
  },

  createFolder: async (name) => {
    const requestGeneration = accountGeneration;
    const data = await bookmarkService.createBookmarkFolder(name);
    if (requestGeneration !== accountGeneration) return null;
    return get().applyBookmarkState(data);
  },

  renameFolder: async (folderId, name) => {
    const requestGeneration = accountGeneration;
    const data = await bookmarkService.renameBookmarkFolder(folderId, name);
    if (requestGeneration !== accountGeneration) return null;
    return get().applyBookmarkState(data);
  },

  deleteFolder: async (folderId) => {
    const requestGeneration = accountGeneration;
    const data = await bookmarkService.deleteBookmarkFolder(folderId);
    if (requestGeneration !== accountGeneration) return null;
    return get().applyBookmarkState(data);
  },

  reset: () => {
    accountGeneration += 1;
    set(buildInitialState());
  },
}));

export default useBookmarkStore;
