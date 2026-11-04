import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Icon from '../common/Icon';
import ThemeToggle from '../common/ThemeToggle';
import useDialogFocus from '../../hooks/useDialogFocus';
import useNotificationStore from '../../store/notificationStore';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import { loadJSON, saveJSON } from '../../utils';

const LOCAL_SEARCH_CONTEXTS = {
  likes: { label: '搜索我的喜爱', placeholder: '搜索喜爱的帖子和评论...' },
  bookmarks: { label: '搜索我的收藏', placeholder: '搜索收藏的帖子...' },
  announcements: { label: '搜索校园公告', placeholder: '搜索校园活动...' },
};

function formatRelativeTime(date) {
  if (!date) return '';
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}

function TopBar({ query, onQueryChange, onNavigate, onAIOpen }) {
  const [inputQuery, setInputQuery] = useState(query);
  const [history, setHistory] = useState(() => (Array.isArray(loadJSON('nju_search_history', [])) ? loadJSON('nju_search_history', []) : []).filter((item) => typeof item === 'string').slice(0, 8));
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => setInputQuery(query), [query]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 681;
  });

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const notificationRef = useRef(null);
  useDialogFocus(notificationRef, showNotifs, () => setShowNotifs(false));
  useEffect(() => {
    if (!showNotifs) return;
    const body = document.body;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight || '0') + scrollbar}px`;
    body.style.overflow = 'hidden';
    return () => { body.style.overflow = previous.overflow; body.style.paddingRight = previous.paddingRight; };
  }, [showNotifs]);

  const activePage = useUiStore((s) => s.activePage);
  const requestFeedScroll = useUiStore((s) => s.requestFeedScroll);
  const localSearchContext = LOCAL_SEARCH_CONTEXTS[activePage];

  // Track viewport width for mobile detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 681);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const confirmSearch = useCallback((value = inputQuery) => {
    const next = value.trim();
    onQueryChange(next);
    setInputQuery(next);
    if (next) setHistory((items) => {
      const updated = [next, ...items.filter((item) => item !== next)].slice(0, 8);
      saveJSON('nju_search_history', updated);
      return updated;
    });
    setHistoryOpen(false);
    setSearchExpanded(false);
    inputRef.current?.blur();
    if (!localSearchContext) {
      if (activePage !== 'home') onNavigate('home');
      requestFeedScroll();
    }
  }, [inputQuery, onQueryChange, activePage, localSearchContext, onNavigate, requestFeedScroll]);
  const collapseSearch = useCallback(() => { setSearchExpanded(false); setHistoryOpen(false); }, []);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isMobile) setSearchExpanded(true);
        else inputRef.current?.focus();
      }
      if (event.key === 'Escape') { setHistoryOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [isMobile]);

  // Close dropdown & expanded search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (historyOpen && !event.target.closest('.search-box') && !event.target.closest('.search-history')) setHistoryOpen(false);
      if (searchExpanded && searchContainerRef.current
          && !searchContainerRef.current.contains(event.target)
          && !event.target.closest('.search-action-btn') && !event.target.closest('.search-history')) {
        collapseSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [searchExpanded, collapseSearch, historyOpen]);

  // ESC key to collapse search
  useEffect(() => {
    if (!searchExpanded) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        collapseSearch();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchExpanded, collapseSearch]);

  // Focus input after expand animation
  useEffect(() => {
    if (searchExpanded && inputRef.current) {
      const timer = setTimeout(() => inputRef.current.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [searchExpanded]);

  // Get notification state from store
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const notificationsLoading = useNotificationStore((s) => s.loading);
  const notificationsError = useNotificationStore((s) => s.error);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const setSelectedPost = usePostStore((s) => s.setSelectedPost);

  // Handle notification click
  const handleNotifClick = (notification) => {
    markAsRead(notification._id);

    if (notification.relatedType === 'post' && notification.relatedId) {
      setSelectedPost(null);
      onNavigate('detail', { selectedPost: { id: notification.relatedId } });
    } else if (notification.relatedType === 'event' && notification.relatedId) {
      onNavigate('announcements');
    }

    setShowNotifs(false);
  };

  // Handle mark all as read
  const handleMarkAllRead = () => {
    markAllAsRead();
    notificationRef.current?.querySelector('.notif-close-btn')?.focus();
  };

  // Expand search on mobile
  const handleSearchFocus = () => {
    if (isMobile && !searchExpanded) {
      setSearchExpanded(true);
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    onQueryChange('');
    setInputQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Action button handler (取消/确认)
  const handleSearchAction = () => {
    if (inputQuery.trim()) confirmSearch();
    else collapseSearch();
  };

  const mobilePlaceholder = localSearchContext?.placeholder || '搜索帖子、话题...';
  const desktopPlaceholder = localSearchContext?.placeholder || '搜索树洞或关键词 · ⌘ / Ctrl K';
  const searchLabel = localSearchContext?.label || '搜索树洞';

  const isExpanded = isMobile && searchExpanded;
  const notificationModal = showNotifs
    ? ReactDOM.createPortal(
      <div className="notif-modal-overlay" onClick={() => setShowNotifs(false)}>
        <section ref={notificationRef} className="notif-modal-panel" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="notification-modal-title">
          <header className="notif-header">
            <div className="notif-heading"><h2 id="notification-modal-title">通知</h2><span>{unreadCount > 0 ? `${unreadCount} 条未读` : '回复与互动消息'}</span></div>
            <div className="notif-actions">
              {unreadCount > 0 && <button type="button" className="notif-mark-read" onClick={handleMarkAllRead}><Icon name="check" />全部已读</button>}
              <button type="button" className="notif-close-btn" data-dialog-focus onClick={() => setShowNotifs(false)} aria-label="关闭通知"><Icon name="close" /></button>
            </div>
          </header>
          {notificationsError && <div className="notif-error" role="alert"><span>{notificationsError}</span><button type="button" onClick={() => useNotificationStore.getState().fetchNotifications()}>重试</button></div>}
          <div className="notif-modal-list" aria-busy={notificationsLoading}>
            {notificationsLoading && !notifications.length ? <p className="notif-loading" role="status">正在加载通知…</p> : !notifications.length && !notificationsError ? (
              <div className="notif-empty"><Icon name="notifications" /><p>暂时没有通知</p><span>新的回复、点赞和活动消息会显示在这里。</span></div>
            ) : notifications.map(n => (
              <button type="button" className={`notif-item ${n.read ? '' : 'unread'}`} key={n._id} onClick={() => handleNotifClick(n)}>
                <span className={`notif-dot ${n.read ? 'is-read' : ''}`} aria-hidden="true" />
                <span className="notif-copy"><strong>{n.title}</strong><span className="notif-content">{n.content}</span><time dateTime={n.createdAt}>{formatRelativeTime(n.createdAt)}</time></span>
                <Icon name="chevron_right" />
              </button>
            ))}
          </div>
        </section>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <header
        className={`topbar sticky top-0 z-20 flex items-center justify-between gap-5 h-[60px] px-7 border-b border-line bg-surface/82 backdrop-blur-xs max-sm:h-[48px] max-sm:px-3 max-sm:gap-2 ${isExpanded ? 'topbar-search-expanded' : ''}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {isExpanded ? (
          /* ── Mobile expanded search layout ── */
          <form ref={searchContainerRef} className="search-box" role="search" onSubmit={(event) => { event.preventDefault(); confirmSearch(); }}>
            <Icon name="search" />
            <input
              ref={inputRef}
              onFocus={() => setHistoryOpen(true)}
              className="w-full border-0 outline-0 text-text bg-transparent text-sm"
              aria-label={searchLabel}
              onChange={(event) => setInputQuery(event.target.value)}
              placeholder={desktopPlaceholder}
              value={inputQuery}
            />
            {inputQuery && (
              <button
                className="search-clear-btn"
                onClick={handleClearSearch}
                type="button"
                aria-label="清除搜索"
              >
                ×
              </button>
            )}
          </form>
        ) : (
          /* ── Normal layout ── */
          <>
            <button className="mobile-brand" type="button" aria-label="南大树洞首页" onClick={() => onNavigate('home')}><Icon name="park" /></button>
            <form className="search-box" role="search" onSubmit={(event) => { event.preventDefault(); confirmSearch(); }}>
              <Icon name="search" />
              <input
                ref={inputRef}
                className="w-full border-0 outline-0 text-text bg-transparent text-sm"
                aria-label={searchLabel}
                onFocus={() => { handleSearchFocus(); setHistoryOpen(true); }}
                onChange={(event) => setInputQuery(event.target.value)}
                placeholder={isMobile ? mobilePlaceholder : desktopPlaceholder}
                value={inputQuery}
              />
              {inputQuery && <button className="search-clear-btn" onClick={handleClearSearch} type="button" aria-label="清除搜索">×</button>}
              <button className="search-submit" type="submit">搜索</button>
            </form>
            <div className="topbar-actions flex items-center gap-2.5 max-sm:gap-1.5">
              <ThemeToggle />
              <button className="ai-topbar-btn" onClick={onAIOpen} type="button" aria-label="树洞 AI">
                <Icon name="smart_toy" />
                <span>树洞 AI</span>
              </button>
              <div className="notif-wrapper relative">
                <button
                  className="icon-button notification-trigger"
                  type="button"
                  aria-label="通知"
                  aria-haspopup="dialog"
                  aria-expanded={showNotifs}
                  onClick={() => setShowNotifs(!showNotifs)}
                >
                  <Icon name="notifications" />
                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              <button className="icon-button max-sm:hidden grid w-[38px] h-[38px] place-items-center rounded-full border border-line bg-surface text-text-2 shadow-xs transition-all duration-150 hover:text-blue hover:border-[#b0c4de] hover:-translate-y-px" type="button" aria-label="个人设置" onClick={() => onNavigate('settings')}>
                <Icon name="person" />
              </button>
            </div>
          </>
        )}

        {/* Action button next to expanded search box */}
        {isExpanded && (
          <button
            className="search-action-btn"
            onClick={handleSearchAction}
            type="button"
          >
            {inputQuery.trim() ? '搜索' : '取消'}
          </button>
        )}
        {historyOpen && history.length > 0 && <div className="search-history" aria-label="最近搜索">
          <div><span>最近搜索</span><button type="button" onClick={() => { setHistory([]); saveJSON('nju_search_history', []); }}>清空记录</button><button type="button" onClick={() => setHistoryOpen(false)}>关闭</button></div>
          {history.map((item) => <button type="button" key={item} onClick={() => confirmSearch(item)}><Icon name="schedule" />{item}</button>)}
        </div>}
      </header>
      {notificationModal}
    </>
  );
}

export default TopBar;
