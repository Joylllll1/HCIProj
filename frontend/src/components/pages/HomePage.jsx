import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Select from '../common/Select';
import PostCard from '../common/PostCard';
import Discussion from '../common/Discussion';
import QuickCompose, { FEED_TOPICS } from '../features/QuickCompose';
import DailyFortune from '../features/DailyFortune';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import useBookmarkStore from '../../store/bookmarkStore';
import usePostActions from '../../hooks/usePostActions';
import useLikeBookmark from '../../hooks/useLikeBookmark';
import * as reportService from '../../services/reportService';

export default function HomePage() {
  const feed = usePostStore();
  const { query, feedTag, setQuery, setFeedTag, navigate, showToast, feedScrollToken } = useUiStore();
  const { bookmarks, collectionFolders, bookmarkFolders } = useBookmarkStore();
  const user = useAuthStore((s) => s.user);
  const [pendingSort, setPendingSort] = useState(null);
  const openIds = useUiStore((s) => s.expandedPostIds);
  const [visitedIds, setVisitedIds] = useState(openIds);
  const [retry, setRetry] = useState(0);
  const feedHeadRef = useRef(null);
  const moreRef = useRef(null);
  const { openPost } = usePostActions();
  const { toggleLike, toggleBookmark } = useLikeBookmark();
  const { fetchPosts, currentSort } = feed;
  useEffect(() => {
    const state = usePostStore.getState();
    if (state.feedLoaded && state.currentQuery === query && state.currentTag === feedTag && !retry) return;
    fetchPosts(1, query, { sort: state.currentSort, tag: feedTag });
  }, [query, feedTag, fetchPosts, retry]);

  useLayoutEffect(() => {
    const y = useUiStore.getState().homeScroll;
    window.scrollTo(0, y);
    const remember = () => useUiStore.setState({ homeScroll: window.scrollY });
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, []);

  useEffect(() => {
    if (!feedScrollToken) return;
    feedHeadRef.current?.scrollIntoView({ block: 'start' });
    useUiStore.setState({ feedScrollToken: 0 });
  }, [feedScrollToken]);

  useEffect(() => {
    if (!moreRef.current || !window.IntersectionObserver || feed.loading || feed.loadingMore || feed.moreError || feed.feedError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) usePostStore.getState().loadMorePosts();
    }, { rootMargin: '160px' });
    observer.observe(moreRef.current);
    return () => observer.disconnect();
  }, [feed.currentPage, feed.totalPages, feed.loading, feed.loadingMore, feed.moreError, feed.feedError]);

  const changeSort = async (sort) => {
    if (pendingSort || sort === currentSort) return;
    setPendingSort(sort);
    await fetchPosts(1, query, { sort, tag: feedTag });
    setPendingSort(null);
  };
  const toggleDiscussion = (id) => {
    setVisitedIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    useUiStore.setState((s) => ({ expandedPostIds: s.expandedPostIds.includes(id) ? s.expandedPostIds.filter((item) => item !== id) : [...s.expandedPostIds, id] }));
  };
  const report = async (id, reason, type = 'post') => {
    try { await reportService.createReport(id, reason, type); showToast('举报已提交'); }
    catch (err) { showToast(err.message || '举报失败'); }
  };
  const topics = FEED_TOPICS.map((tag) => <button key={tag} type="button" className={`topic-link ${feedTag === tag ? 'selected' : ''}`} aria-pressed={feedTag === tag} onClick={() => setFeedTag(feedTag === tag ? '' : tag)}><span className="topic-hash">#</span>{tag}<Icon name="chevron_right" /></button>);
  const stale = feed.currentQuery !== query || feed.currentTag !== feedTag;
  return (
    <div className="home-grid">
      <section className="feed-column" aria-label="树洞信息流">
        <QuickCompose />
        <div className="feed-toolbar" ref={feedHeadRef}>
          <div className="feed-tabs" aria-label="动态排序">
            {[['latest', '最新发布'], ['hot', '高赞共鸣']].map(([value, label]) => <button type="button" key={value} className={`feed-tab ${currentSort === value ? 'selected' : ''}`} aria-pressed={currentSort === value} disabled={Boolean(pendingSort)} onClick={() => changeSort(value)}>{pendingSort === value ? `${label} · 加载中` : label}</button>)}
          </div>
          <Select className="feed-tag-select" aria-label="筛选话题" value={feedTag} onChange={setFeedTag} options={[{ value: '', label: '不限话题' }, ...FEED_TOPICS.map(tag => ({ value: tag, label: tag, group: '常用话题' }))]} />
          <button className="icon-button feed-refresh" type="button" aria-label="刷新树洞" title="刷新树洞" aria-busy={feed.loading} disabled={feed.loading} onClick={() => setRetry((n) => n + 1)}><Icon name="refresh" /></button>
        </div>
        {(query || feedTag) && <div className="feed-search-result" role="status"><span>{query && `搜索“${query}”`}{query && feedTag && ' · '}{feedTag && `#${feedTag}`}{!stale && !feed.loading && ` · ${feed.totalPosts} 条`}</span><button type="button" onClick={() => { setQuery(''); setFeedTag(''); }}>清除筛选 <Icon name="close" /></button></div>}
        {feed.feedError && <div className="feed-error" role="alert"><span>{feed.feedError}{feed.posts.length > 0 && ' 当前保留上次加载的内容。'}</span><button type="button" onClick={() => feed.retryFeed()}>重新加载</button></div>}
        <h2 className="sr-only">树洞列表</h2>
        <div className="post-list" aria-busy={feed.loading}>
          {feed.loading && <p className="feed-loading" role="status">正在更新树洞…</p>}
          {feed.posts.map((post) => {
            const view = feed.getPostLikeView(post);
            const expanded = openIds.includes(post.id);
            return <div className="feed-thread" key={post.id}>
              <PostCard post={view} onOpen={() => openPost(post)} onDiscuss={() => toggleDiscussion(post.id)} expanded={expanded} previewMode liked={view.isLiked} bookmarked={view.isSaved} onLike={() => toggleLike(post.id)} onBookmark={() => toggleBookmark(post.id)} onReport={report} />
              {visitedIds.includes(post.id) && <div hidden={!expanded} id={`discussion-${post.id}`} className="inline-discussion"><Discussion post={post} currentUserId={user?._id} onReport={report} /><div className="discussion-bottom"><button type="button" onClick={() => { toggleDiscussion(post.id); document.getElementById(`discuss-${post.id}`)?.focus(); }}>收起评论</button><button type="button" onClick={() => openPost(post)}>打开完整树洞 <Icon name="arrow_forward" /></button></div></div>}
            </div>;
          })}
          {!feed.posts.length && !feed.loading && !feed.feedError && <div className="feed-empty"><p>{query || feedTag ? '没有找到相关树洞，换个关键词或话题试试。' : '还没有树洞，写下第一条校园日常吧。'}</p>{(query || feedTag) && <button className="secondary-button" type="button" onClick={() => { setQuery(''); setFeedTag(''); }}>查看全部树洞</button>}</div>}
          {feed.currentPage < feed.totalPages && !stale ? <div className="feed-more" ref={moreRef}>{feed.moreError && <p role="alert" className="inline-error">{feed.moreError}</p>}<button type="button" className="secondary-button" disabled={feed.loadingMore || feed.loading} onClick={() => feed.loadMorePosts()}>{feed.loadingMore ? '加载中...' : feed.moreError ? '重试加载更多' : '加载更多'}</button></div> : feed.posts.length > 0 && <p className="feed-end">已看完 · {feed.totalPosts} 条树洞</p>}
        </div>
      </section>
      <aside className="community-rail" aria-label="校园与个人空间">
        <section className="rail-section"><div className="rail-heading"><h2>我的收藏夹</h2><Icon name="bookmark_border" /></div><div className="rail-folders">{collectionFolders.map((folder) => <button type="button" key={folder.id} onClick={() => navigate('bookmarks', { bookmarkFolder: folder.id })}><Icon name="folder" /><span>{folder.name}</span><small>{folder.id === 'all' ? bookmarks.length : (bookmarkFolders[folder.id] || []).filter((id) => bookmarks.includes(id)).length}</small></button>)}</div></section>
        <section className="rail-section"><div className="rail-heading"><h2>常用话题</h2><Icon name="tag" /></div><div className="rail-topics">{topics}</div></section>
        <details className="rail-section fortune-section"><summary>今日运势</summary><DailyFortune showToast={showToast} /></details>
        <p className="rail-footer">南大树洞 · NJU Treehole<br />友善表达，尊重每一种声音。</p>
      </aside>
    </div>
  );
}
