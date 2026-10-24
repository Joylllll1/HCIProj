import useDialogFocus from '../../hooks/useDialogFocus';
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';
import PageHeader from '../common/PageHeader';
import React, { useState, useEffect, useLayoutEffect, useRef, useId } from 'react';
import Icon from '../common/Icon';
import PostCard from '../common/PostCard';
import EmptyState from '../common/EmptyState';
import * as postService from '../../services/postService';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import { hasSearchQuery, matchPostQuery } from '../../utils/search';

const BOOKMARKS_PAGE_BATCH_SIZE = 20;

const selectGetPostLikeView = (s) => s.getPostLikeView;
const selectQuery = (s) => s.query;

function BookmarksPage({
  compact,
  posts,
  bookmarks,
  onOpenPost,
  onLike,
  onBookmark,
  onReport,
  collectionFolders = [],
  bookmarkFolders = {},
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  const activeFolder = useUiStore((s) => s.bookmarkFolder);
  const setActiveFolder = (bookmarkFolder) => useUiStore.setState({ bookmarkFolder });
  const [showFolderMenu, setShowFolderMenu] = useState(null);
  const [folderMenuPosition, setFolderMenuPosition] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [pendingFolderOperation, setPendingFolderOperation] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [savedPosts, setSavedPosts] = useState([]);
  const [visiblePostCount, setVisiblePostCount] = useState(BOOKMARKS_PAGE_BATCH_SIZE);
  const menuRefs = useRef({});
  const menuTriggerRefs = useRef({});
  const firstMenuItemRefs = useRef({});
  const folderButtonRefs = useRef({});
  const focusAllAfterDeleteRef = useRef(false);
  const pendingFolderOperationRef = useRef(null);
  const disclosureId = useId();
  const newFolderRef = useRef(null);
  const renameFolderRef = useRef(null);
  useDialogFocus(newFolderRef, showNewFolderModal, () => {
    if (!pendingFolderOperationRef.current) closeCreateFolder();
  }, pendingFolderOperation === 'create');
  useDialogFocus(renameFolderRef, Boolean(editingFolder), () => {
    if (!pendingFolderOperationRef.current) closeRenameFolder();
  }, pendingFolderOperation === 'rename');
  const getPostLikeView = usePostStore(selectGetPostLikeView);
  const query = useUiStore(selectQuery);

  useLayoutEffect(() => {
    if (!showFolderMenu) return undefined;
    const place = () => {
      const trigger = menuTriggerRefs.current[showFolderMenu];
      const menu = menuRefs.current[showFolderMenu]?.querySelector('.folder-menu-dropdown');
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) { setShowFolderMenu(null); return; }
      const viewportWidth = document.documentElement.clientWidth || innerWidth;
      const width = Math.min(176, viewportWidth - 24);
      const height = Math.min(menu.scrollHeight, 288);
      const top = rect.bottom + 6 + height <= innerHeight - 12 ? rect.bottom + 6 : Math.max(12, rect.top - height - 6);
      setFolderMenuPosition({ position: 'fixed', width, left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)), top, marginTop: 0, maxHeight: Math.max(40, innerHeight - top - 12), overflowY: 'auto' });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [showFolderMenu]);

  // Treat folder actions as a disclosure: clicking or moving focus outside closes it.
  useEffect(() => {
    if (!showFolderMenu) return undefined;

    firstMenuItemRefs.current[showFolderMenu]?.focus({ preventScroll: true });

    const closeIfOutside = (event) => {
      const disclosure = menuRefs.current[showFolderMenu];
      if (disclosure && !disclosure.contains(event.target)) setShowFolderMenu(null);
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setShowFolderMenu(null);
      menuTriggerRefs.current[showFolderMenu]?.focus({ preventScroll: true });
    };

    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('focusin', closeIfOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('focusin', closeIfOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showFolderMenu, disclosureId]);

  // ── Fetch the authoritative saved post list for this user ──
  useEffect(() => {
    if (bookmarks.length === 0) {
      setLoadError('');
      setLoadingSaved(false);
      setSavedPosts([]);
      return;
    }

    let cancelled = false;
    setLoadError('');
    setLoadingSaved(true);
    postService.fetchSavedPosts()
      .then((data) => {
        if (!cancelled) {
          setSavedPosts(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || '收藏加载失败，请重试。');
      })
      .finally(() => { if (!cancelled) setLoadingSaved(false); });

    return () => {
      cancelled = true;
    };
  }, [bookmarks.length, retryToken]);

  const beginFolderOperation = (operation) => {
    if (pendingFolderOperationRef.current) return false;
    pendingFolderOperationRef.current = operation;
    setPendingFolderOperation(operation);
    return true;
  };

  const finishFolderOperation = () => {
    pendingFolderOperationRef.current = null;
    setPendingFolderOperation('');
  };

  const openCreateFolder = () => {
    setCreateError('');
    setNewFolderName('');
    setShowNewFolderModal(true);
  };

  const closeCreateFolder = () => {
    setShowNewFolderModal(false);
    setCreateError('');
    setNewFolderName('');
  };

  const closeRenameFolder = () => {
    setEditingFolder(null);
    setRenameError('');
    setEditFolderName('');
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !beginFolderOperation('create')) return;
    setCreateError('');
    try {
      await onCreateFolder(name);
      setShowNewFolderModal(false);
      setNewFolderName('');
      setCreateError('');
    } catch (error) {
      setCreateError(error?.message || '创建收藏夹失败，请重试。');
    } finally {
      finishFolderOperation();
    }
  };

  const handleRenameFolder = async () => {
    const name = editFolderName.trim();
    if (!editingFolder || !name || !beginFolderOperation('rename')) return;
    setRenameError('');
    try {
      await onRenameFolder(editingFolder, name);
      closeRenameFolder();
    } catch (error) {
      setRenameError(error?.message || '重命名失败，请重试。');
    } finally {
      finishFolderOperation();
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget || !beginFolderOperation('delete')) return;
    setDeleteError('');
    try {
      await onDeleteFolder(deleteFolderTarget.id);
      if (activeFolder === deleteFolderTarget.id) {
        setActiveFolder('all');
        focusAllAfterDeleteRef.current = true;
      }
      setDeleteFolderTarget(null);
      setDeleteError('');
    } catch (error) {
      setDeleteError(error?.message || '删除收藏夹失败，请重试。');
    } finally {
      finishFolderOperation();
    }
  };

  const openDeleteFolder = (folder) => {
    const itemCount = (bookmarkFolders[folder.id] || []).length;
    focusFolderTrigger(folder.id);
    setDeleteError('');
    setDeleteFolderTarget({ ...folder, itemCount });
    setShowFolderMenu(null);
  };

  const submitOnEnter = (event, submit) => {
    if (event.key !== 'Enter' || event.nativeEvent?.isComposing || event.nativeEvent?.keyCode === 229) return;
    event.preventDefault();
    submit();
  };

  const focusFolderTrigger = (folderId) => {
    menuTriggerRefs.current[folderId]?.focus({ preventScroll: true });
  };

  // Get bookmarked posts for the active folder
  const getBookmarksForFolder = (folderId) => {
    const source = savedPosts.length > 0 ? savedPosts : posts;
    if (folderId === 'all') {
      // Return all bookmarked posts
      return source.filter((p) => bookmarks.includes(p.id));
    }
    // Return posts bookmarked in this specific folder
    const bookmarkIds = bookmarkFolders[folderId] || [];
    return source.filter((p) => bookmarkIds.includes(p.id));
  };

  const folderPosts = getBookmarksForFolder(activeFolder);
  const filteredFolderPosts = folderPosts.filter((post) => matchPostQuery(post, query));
  const visibleFolderPosts = filteredFolderPosts.slice(0, visiblePostCount);
  const totalItems = filteredFolderPosts.length;
  const searching = hasSearchQuery(query);

  useEffect(() => {
    setVisiblePostCount(BOOKMARKS_PAGE_BATCH_SIZE);
  }, [activeFolder, query]);

  useEffect(() => {
    if (!deleteFolderTarget && focusAllAfterDeleteRef.current) {
      focusAllAfterDeleteRef.current = false;
      folderButtonRefs.current.all?.focus({ preventScroll: true });
    }
  }, [deleteFolderTarget, collectionFolders]);

  return (
    <div className="collection-page saved-page">
      {!compact && (
        <PageHeader title="我的收藏" description="按收藏夹整理，留着慢慢看。" actions={<button className="secondary-button" onClick={openCreateFolder} type="button"><Icon name="add" />新建收藏夹</button>} />
      )}

      <div className="category-row collection-tabs flex flex-wrap gap-3 max-sm:gap-1 my-[22px] items-center">
        {collectionFolders.map((folder) => {
          const folderPosts = getBookmarksForFolder(folder.id);
          const count = folderPosts.length;
          const isMenuOpen = showFolderMenu === folder.id;
          const isActive = activeFolder === folder.id;
          const hasMenu = !folder.isDefault;

          return (
            <div key={folder.id} className="folder-pill-container inline-flex items-center gap-1" ref={(el) => { menuRefs.current[folder.id] = el; }}>
              {/* Folder name button - click to switch */}
              <button
                ref={(el) => { folderButtonRefs.current[folder.id] = el; }}
                className={`folder-name-btn px-4 py-[10px] text-sm font-semibold rounded-full border transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-soft text-blue border border-blue'
                    : 'bg-surface text-text-2 border-line hover:border-blue/40 hover:text-blue hover:shadow-sm'
                }`}
                aria-pressed={isActive}
                onClick={() => { setActiveFolder(folder.id); setShowFolderMenu(null); }}
                type="button"
              >
                <span className="folder-name-label" title={folder.name}>{folder.name}</span>
                <span className={`ml-1.5 text-xs ${isActive ? 'text-blue' : 'text-text-3'}`}>
                  ({count})
                </span>
              </button>

              {/* Action dot button - click to show menu */}
              {hasMenu && (
                <>
                  <button
                    ref={(el) => { menuTriggerRefs.current[folder.id] = el; }}
                    className={`action-dot w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                      isMenuOpen
                        ? 'bg-surface text-text shadow-sm'
                        : 'bg-surface-soft text-text-3 hover:bg-surface hover:text-text hover:shadow-sm'
                    }`}
                    onClick={(e) => { e.stopPropagation(); setShowFolderMenu(isMenuOpen ? null : folder.id); }}
                    type="button"
                    aria-label={`更多收藏夹操作：${folder.name}`}
                    aria-expanded={isMenuOpen}
                    aria-controls={`${disclosureId}-folder-${encodeURIComponent(folder.id)}`}
                  >
                    <Icon name="more_horiz" style={{ fontSize: '16px' }} />
                  </button>
                  <div hidden={!isMenuOpen} style={isMenuOpen ? folderMenuPosition : undefined} id={`${disclosureId}-folder-${encodeURIComponent(folder.id)}`} role="group" aria-label={`${folder.name}收藏夹操作`} className="folder-menu-dropdown absolute top-full left-0 mt-2 z-20 w-40 overflow-hidden rounded-xl border border-line-soft/80 bg-surface shadow-xl shadow-black/8 animate-menu-in">
                    <div className="p-1.5">
                      <button
                        ref={(el) => { firstMenuItemRefs.current[folder.id] = el; }}
                        className="menu-item w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-2 rounded-lg transition-all duration-150 hover:bg-surface-soft"
                        onClick={(e) => {
                          e.stopPropagation();
                          focusFolderTrigger(folder.id);
                          setEditingFolder(folder.id);
                          setEditFolderName(folder.name);
                          setRenameError('');
                          setShowFolderMenu(null);
                        }}
                        type="button"
                      >
                        <Icon name="edit_square" style={{ fontSize: '15px' }} />
                        重命名
                      </button>
                      <button
                        className="menu-item w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red rounded-lg transition-all duration-150 hover:bg-red-soft/40"
                        onClick={(e) => { e.stopPropagation(); openDeleteFolder(folder); }}
                        type="button"
                      >
                        <Icon name="delete" style={{ fontSize: '15px' }} />
                        删除
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {compact && <button className="secondary-button" onClick={openCreateFolder} type="button"><Icon name="add" />新建收藏夹</button>}
      </div>

      {searching && (
        <p className="result-hint mb-[14px] text-text-2 text-sm">
          搜索 &quot;{query}&quot; 找到 {totalItems} 条相关收藏。
        </p>
      )}

      {loadError && <div className="feed-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => setRetryToken((n) => n + 1)}>重试加载收藏</button></div>}
      {loadingSaved && <p role="status">正在加载收藏…</p>}
      {totalItems === 0 && (loadError || loadingSaved) ? null : totalItems === 0 ? (
        <EmptyState
          title={
            searching
              ? '没有找到匹配的收藏'
              : activeFolder === 'all'
                ? '还没有收藏内容'
                : `"${collectionFolders.find((f) => f.id === activeFolder)?.name || '此文件夹'}" 暂无收藏`
          }
          description={searching ? '换个关键词试试。' : '浏览树洞时点击书签图标即可收藏。'}
        />
      ) : (
        <>
          <section className="saved-post-list">
            {visibleFolderPosts.map((post) => {
              const postView = getPostLikeView(post);
              return (
                <div key={postView.id} className="saved-post-entry">
                  <PostCard
                    compact
                    post={postView}
                    onOpen={() => onOpenPost(post)}
                    previewMode
                    liked={postView.isLiked}
                    bookmarked
                    onLike={() => onLike(post.id)}
                    onBookmark={() => onBookmark(post.id)}
                    onReport={onReport}
                  />
                </div>
              );
            })}
          </section>
          {visibleFolderPosts.length < filteredFolderPosts.length && (
            <div className="pt-2">
              <button
                type="button"
                className="secondary-button w-full"
                onClick={() => setVisiblePostCount((count) => count + BOOKMARKS_PAGE_BATCH_SIZE)}
              >
                加载更多
              </button>
            </div>
          )}
        </>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={() => { if (!pendingFolderOperationRef.current) closeCreateFolder(); }}>
          <div ref={newFolderRef} role="dialog" aria-modal="true" aria-labelledby="create-folder-heading" aria-describedby={createError ? 'create-folder-error' : undefined} aria-busy={pendingFolderOperation === 'create'} className="modal-content w-[min(400px,90vw)] rounded-lg bg-surface shadow-md animate-modal-scale-in p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="create-folder-heading" className="text-2xl tracking-tight mb-4">新建收藏夹</h2>
            <input
              aria-label="收藏夹名称"
              data-dialog-focus
              autoFocus
              disabled={pendingFolderOperation === 'create'}
              className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm mb-4"
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={(e) => { setNewFolderName(e.target.value); if (createError) setCreateError(''); }}
              onKeyDown={(e) => submitOnEnter(e, handleCreateFolder)}
            />
            {createError && <p id="create-folder-error" className="danger-text mb-4" role="alert">{createError}</p>}
            <div className="flex justify-end gap-3">
              <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-surface text-text-2 text-sm font-semibold transition-all duration-150" onClick={closeCreateFolder} disabled={pendingFolderOperation === 'create'} type="button">取消</button>
              <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleCreateFolder} disabled={!newFolderName.trim() || pendingFolderOperation === 'create'} type="button">{pendingFolderOperation === 'create' ? '创建中…' : createError ? '重试创建' : '创建'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={() => { if (!pendingFolderOperationRef.current) closeRenameFolder(); }}>
          <div ref={renameFolderRef} role="dialog" aria-modal="true" aria-labelledby="rename-folder-heading" aria-describedby={renameError ? 'rename-folder-error' : undefined} aria-busy={pendingFolderOperation === 'rename'} className="modal-content w-[min(400px,90vw)] rounded-lg bg-surface shadow-md animate-modal-scale-in p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="rename-folder-heading" className="text-2xl tracking-tight mb-4">重命名收藏夹</h2>
            <input
              aria-label="新的收藏夹名称"
              data-dialog-focus
              autoFocus
              disabled={pendingFolderOperation === 'rename'}
              className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm mb-4"
              placeholder="文件夹名称"
              value={editFolderName}
              onChange={(e) => { setEditFolderName(e.target.value); if (renameError) setRenameError(''); }}
              onKeyDown={(e) => submitOnEnter(e, handleRenameFolder)}
            />
            {renameError && <p id="rename-folder-error" className="danger-text mb-4" role="alert">{renameError}</p>}
            <div className="flex justify-end gap-3">
              <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-surface text-text-2 text-sm font-semibold transition-all duration-150" onClick={closeRenameFolder} disabled={pendingFolderOperation === 'rename'} type="button">取消</button>
              <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleRenameFolder} disabled={!editFolderName.trim() || pendingFolderOperation === 'rename'} type="button">{pendingFolderOperation === 'rename' ? '保存中…' : renameError ? '重试保存' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmLeaveDialog
        open={Boolean(deleteFolderTarget)}
        title="删除收藏夹？"
        description={deleteFolderTarget ? `“${deleteFolderTarget.name}”中的 ${deleteFolderTarget.itemCount} 条收藏会移至“全部”，帖子不会从收藏中移除。` : ''}
        error={deleteError}
        confirmText={pendingFolderOperation === 'delete' ? '删除中…' : deleteError ? '重试删除' : '删除收藏夹'}
        cancelText="保留收藏夹"
        mode="discard"
        pending={pendingFolderOperation === 'delete'}
        onConfirm={handleDeleteFolder}
        onCancel={() => {
          if (pendingFolderOperationRef.current) return;
          setDeleteFolderTarget(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}

export default BookmarksPage;
