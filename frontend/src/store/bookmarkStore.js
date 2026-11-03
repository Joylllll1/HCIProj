import { create } from 'zustand';
import * as bookmarkService from '../services/bookmarkService';
import { loadJSON } from '../utils';
import useAuthStore from './authStore';
import usePostStore from './postStore';

const DEFAULT_FOLDERS = [{ id: 'all', name: '全部', isDefault: true }];
const LEGACY_MIGRATION_KEY = 'nju_bookmarks_server_migrated_v1';

function sanitizeBookmarkPayload(data = {}) {
  return {
    version: Number.isSafeInteger(data.version) ? data.version : 0,
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
    version: 0,
    accountGeneration: 0,
    accountKey: null,
    bookmarks: [],
    collectionFolders: DEFAULT_FOLDERS,
    bookmarkFolders: {},
    folderSelectorOpen: false,
    pendingBookmarkItem: null,
    loading: false,
    initialized: false,
  };
}

function captureAccount(store) {
  return { generation: store.accountGeneration, userId: useAuthStore.getState().user?._id ?? null };
}

function isCurrent(store, token) {
  return store.accountGeneration === token.generation
    && (useAuthStore.getState().user?._id ?? null) === token.userId;
}

const useBookmarkStore = create((set, get) => {
  const perform = async (request, { batch = false } = {}) => {
    const token = captureAccount(get());
    try {
      const data = await request();
      if (!isCurrent(get(), token)) throw new Error('账号已切换');
      const accepted = get().applyBookmarkState(data);
      if (batch && accepted) {
        for (const post of data.postStates || []) {
          usePostStore.getState().syncSaveState(post.postId, { saved: post.isSaved, saves: post.saves });
        }
      }
      return data;
    } catch (error) {
      if (isCurrent(get(), token) && (error.status === 409 || error.data?.errorCode === 'BOOKMARK_RECONCILING')) {
        await get().loadBookmarks().catch(() => {});
      }
      throw error;
    }
  };

  return {
    ...buildInitialState(),

    applyBookmarkState: (data) => {
      const next = sanitizeBookmarkPayload(data);
      if (next.version < get().version) {
        set({ loading: false, initialized: true });
        return null;
      }
      set({ ...next, loading: false, initialized: true });
      return next;
    },

    resetForAccountChange: () => {
      set((state) => ({ ...buildInitialState(), accountGeneration: state.accountGeneration + 1 }));
    },

    loadBookmarks: async () => {
      const userId = useAuthStore.getState().user?._id ?? null;
      if (get().accountKey !== userId) {
        set((state) => ({ ...buildInitialState(), accountKey: userId, accountGeneration: state.accountGeneration + 1 }));
      }
      const token = captureAccount(get());
      set({ loading: true });
      try {
        const data = await bookmarkService.fetchBookmarks();
        if (!isCurrent(get(), token)) return null;
        let next = get().applyBookmarkState(data);

        if (!hasMigratedLegacyBookmarks()) {
          const legacyPayload = getLegacyPayload();
          if (hasLegacyBookmarkData(legacyPayload)) {
            const migrated = await bookmarkService.migrateLegacyBookmarks(legacyPayload);
            if (!isCurrent(get(), token)) return null;
            next = get().applyBookmarkState(migrated);
          }
          markLegacyMigrated();
        }
        return next;
      } catch (error) {
        if (isCurrent(get(), token)) set({ loading: false, initialized: true });
        throw error;
      }
    },

    toggleBookmark: async (itemId) => {
      if (get().bookmarks.includes(itemId)) {
        const data = await perform(() => bookmarkService.removeBookmark(itemId));
        return { status: 'removed', data };
      }
      set({ pendingBookmarkItem: { id: itemId, type: 'post' }, folderSelectorOpen: true });
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
      const data = await perform(() => bookmarkService.saveBookmark(pendingItem.id, folderId));
      set({ folderSelectorOpen: false, pendingBookmarkItem: null });
      return { status: 'added', data };
    },

    closeFolderSelector: () => set({ folderSelectorOpen: false, pendingBookmarkItem: null }),
    createFolder: (name) => perform(() => bookmarkService.createBookmarkFolder(name)),
    renameFolder: (folderId, name) => perform(() => bookmarkService.renameBookmarkFolder(folderId, name)),
    deleteFolder: (folderId) => perform(() => bookmarkService.deleteBookmarkFolder(folderId)),
    moveBookmarks: (postIds, folderId) => {
      const version = get().version;
      return perform(() => bookmarkService.moveBookmarks(postIds, folderId, version), { batch: true });
    },
    removeBookmarks: (postIds) => {
      const version = get().version;
      return perform(() => bookmarkService.removeBookmarks(postIds, version), { batch: true });
    },
    reset: () => set((state) => ({ ...buildInitialState(), accountGeneration: state.accountGeneration + 1 })),
  };
});

export default useBookmarkStore;
