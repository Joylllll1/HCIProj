import { useCallback } from 'react';
import usePostStore from '../store/postStore';
import useBookmarkStore from '../store/bookmarkStore';
import useUiStore from '../store/uiStore';

// ─── Stable store selectors ───
const selectToggleLike = (s) => s.toggleLike;
const selectToggleBookmark = (s) => s.toggleBookmark;
const selectSelectFolder = (s) => s.selectFolder;
const selectSyncSaveState = (s) => s.syncSaveState;
const selectShowToast = (s) => s.showToast;

export default function useLikeBookmark() {
  const toggleLike = usePostStore(selectToggleLike);
  const syncSaveState = usePostStore(selectSyncSaveState);
  const toggleBookmark = useBookmarkStore(selectToggleBookmark);
  const selectFolder = useBookmarkStore(selectSelectFolder);
  const showToast = useUiStore(selectShowToast);

  const handleToggleLike = useCallback((postId) => {
    toggleLike(postId);
  }, [toggleLike]);

  const handleToggleBookmark = useCallback((itemId) => {
    Promise.resolve(toggleBookmark(itemId))
      .then((result) => {
        if (result?.status === 'removed') {
          syncSaveState(itemId, result.data);
          showToast('已取消收藏');
        }
      })
      .catch((error) => {
        showToast(error.message || '收藏操作失败');
      });
  }, [syncSaveState, toggleBookmark, showToast]);

  const handleSelectFolder = useCallback((folderId) => {
    const store = useBookmarkStore.getState();
    const itemId = store.pendingBookmarkItem?.id;

    Promise.resolve(selectFolder(folderId))
      .then((result) => {
        if (result?.status === 'added') {
          if (itemId) {
            syncSaveState(itemId, result.data);
          }
          showToast('已收藏');
        }
      })
      .catch((error) => {
        showToast(error.message || '收藏操作失败');
      });
  }, [selectFolder, showToast, syncSaveState]);

  return {
    toggleLike: handleToggleLike,
    toggleBookmark: handleToggleBookmark,
    selectFolder: handleSelectFolder,
  };
}
