import { useCallback } from 'react';
import usePostStore from '../store/postStore';
import useBookmarkStore from '../store/bookmarkStore';
import useUiStore from '../store/uiStore';

// ─── Stable store selectors ───
const selectToggleLike = (s) => s.toggleLike;
const selectToggleBookmark = (s) => s.toggleBookmark;
const selectSelectFolder = (s) => s.selectFolder;
const selectShowToast = (s) => s.showToast;

export default function useLikeBookmark() {
  const toggleLike = usePostStore(selectToggleLike);
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
          showToast('已取消收藏');
        }
      })
      .catch((error) => {
        showToast(error.message || '收藏操作失败');
      });
  }, [toggleBookmark, showToast]);

  const handleSelectFolder = useCallback((folderId) => {
    Promise.resolve(selectFolder(folderId))
      .then((result) => {
        if (result?.status === 'added') {
          showToast('已收藏');
        }
      })
      .catch((error) => {
        showToast(error.message || '收藏操作失败');
      });
  }, [selectFolder, showToast]);

  return {
    toggleLike: handleToggleLike,
    toggleBookmark: handleToggleBookmark,
    selectFolder: handleSelectFolder,
  };
}
