import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import HeroCarousel from '../features/HeroCarousel';
import PostCard from '../common/PostCard';
import EmptyState from '../common/EmptyState';
import DailyFortune from '../features/DailyFortune';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import usePostActions from '../../hooks/usePostActions';
import useLikeBookmark from '../../hooks/useLikeBookmark';
import * as reportService from '../../services/reportService';

// ─── Stable store selectors ───
const selectLoading = (s) => s.loading;
const selectGetPostLikeView = (s) => s.getPostLikeView;
const selectPosts = (s) => s.posts;
const selectFetchPosts = (s) => s.fetchPosts;
const selectLoadMorePosts = (s) => s.loadMorePosts;
const selectLoadingMore = (s) => s.loadingMore;
const selectCurrentPage = (s) => s.currentPage;
const selectTotalPages = (s) => s.totalPages;
const selectTotalPosts = (s) => s.totalPosts;
const selectQuery = (s) => s.query;
const selectNavigate = (s) => s.navigate;
const selectShowToast = (s) => s.showToast;

const selectFeedScrollToken = (s) => s.feedScrollToken;

export default function HomePage() {
  const [sort, setSort] = useState('latest');
  const [requestedSort, setRequestedSort] = useState('latest');
  const feedHeadRef = useRef(null);

  // ── Stores ──
  const loading = usePostStore(selectLoading);
  const loadingMore = usePostStore(selectLoadingMore);
  const getPostLikeView = usePostStore(selectGetPostLikeView);
  const posts = usePostStore(selectPosts);
  const fetchPosts = usePostStore(selectFetchPosts);
  const loadMorePosts = usePostStore(selectLoadMorePosts);
  const currentPage = usePostStore(selectCurrentPage);
  const totalPages = usePostStore(selectTotalPages);
  const totalPosts = usePostStore(selectTotalPosts);
  const query = useUiStore(selectQuery);
  const navigate = useUiStore(selectNavigate);
  const showToast = useUiStore(selectShowToast);
  const user = useAuthStore((s) => s.user);
  const feedScrollToken = useUiStore(selectFeedScrollToken);

  // ── Hooks ──
  const { openPost } = usePostActions();
  const { toggleLike, toggleBookmark } = useLikeBookmark();

  const userId = user?._id || null;
  const deferredQuery = useDeferredValue(query);
  const pendingSort = requestedSort !== sort ? requestedSort : null;

  useEffect(() => {
    let cancelled = false;
    const targetSort = requestedSort;

    const loadFeed = async () => {
      await fetchPosts(1, deferredQuery, { sort: targetSort });
      if (!cancelled && requestedSort === targetSort) {
        setSort(targetSort);
      }
    };

    loadFeed();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, fetchPosts, requestedSort]);

  // Scroll to feed section when search confirms from TopBar (mobile only)
  useEffect(() => {
    if (feedScrollToken > 0 && feedHeadRef.current && window.innerWidth < 640) {
      const el = feedHeadRef.current;
      const scrollToFeed = () => {
        const topbar = document.querySelector('.topbar');
        const topbarH = topbar ? topbar.getBoundingClientRect().height : 48;
        el.style.scrollMarginTop = `${topbarH + 4}px`;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      // On mobile the keyboard closes after search confirm, which resizes
      // the viewport. Wait for that animation to finish before scrolling.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToFeed();
          // Re-scroll after keyboard-close viewport change settles
          setTimeout(scrollToFeed, 250);
        });
      });
      useUiStore.setState({ feedScrollToken: 0 });
    }
  }, [feedScrollToken]);

  const handleReport = async (postId, reason, targetType = 'post') => {
    try {
      await reportService.createReport(postId, reason, targetType);
      showToast('举报已提交');
    } catch (err) {
      showToast(err.message || '举报失败');
    }
  };

  return (
    <div className="home-grid grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-w-[1380px] mx-auto max-lg:grid-cols-1">
      <section className="min-w-0">
        <HeroCarousel onNavigate={navigate} />
        <div className="overview-strip grid grid-cols-3 gap-3.5 mt-[18px] max-lg:grid-cols-1">
          <article className="overview-card p-4 rounded-md border border-line bg-white/80 shadow-xs">
            <span className="overview-label inline-block mb-1.5 text-blue text-[11px] font-bold tracking-widest uppercase">匿名表达</span>
            <strong className="block text-[17px] tracking-tight">同帖稳定 · 跨帖不可关联</strong>
            <p className="mt-1.5 mb-0 text-text-2 text-[13px] leading-relaxed">减少熟人压力，同时保留讨论连续性。</p>
          </article>
          <article className="overview-card p-4 rounded-md border border-line bg-white/80 shadow-xs">
            <span className="overview-label inline-block mb-1.5 text-blue text-[11px] font-bold tracking-widest uppercase">内容组织</span>
            <strong className="block text-[17px] tracking-tight">标签、搜索、收藏</strong>
            <p className="mt-1.5 mb-0 text-text-2 text-[13px] leading-relaxed">用更低成本找到真正相关的内容和情绪。</p>
          </article>
          <article className="overview-card p-4 rounded-md border border-line bg-white/80 shadow-xs">
            <span className="overview-label inline-block mb-1.5 text-blue text-[11px] font-bold tracking-widest uppercase">社区治理</span>
            <strong className="block text-[17px] tracking-tight">举报与后台追责</strong>
            <p className="mt-1.5 mb-0 text-text-2 text-[13px] leading-relaxed">匿名不等于失控，平台仍然可治理、可审计。</p>
          </article>
        </div>
        <div className="section-head flex items-end justify-between gap-[18px] mt-[30px] mb-[18px] max-sm:flex-col max-sm:items-stretch">
          <div>
            <p className="eyebrow mb-1.5 text-blue text-xs font-bold tracking-widest uppercase">Anonymous Feed</p>
            <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">全站动态</h1>
          </div>
          <div ref={feedHeadRef} className="tabs flex flex-wrap gap-2 max-sm:w-full" aria-label="动态排序">
            {[
              ['latest', '最新发布'],
              ['hot', '高赞共鸣'],
            ].map(([key, label]) => (
              <button
                className={`rounded-full px-[14px] py-2 text-[13px] font-semibold transition-all duration-150 ${
                  sort === key
                    ? 'bg-blue-soft text-blue border border-blue'
                    : 'bg-white text-text-2 border border-line hover:border-[#b0c4de] hover:text-blue'
                } ${pendingSort === key ? 'opacity-75 cursor-wait' : ''} max-sm:flex-1`}
                key={key}
                onClick={() => {
                  if (pendingSort || sort === key) return;
                  setRequestedSort(key);
                }}
                disabled={Boolean(pendingSort)}
                type="button"
              >
                {pendingSort === key ? `${label} · 加载中` : label}
              </button>
            ))}
          </div>
        </div>
        {query && (
          <p className="result-hint mb-[14px] text-text-2 text-sm">
            搜索 &quot;{query}&quot; 找到 {totalPosts} 条相关树洞。
          </p>
        )}
        <div className="post-list grid gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-3">
              <Icon name="hourglass_empty" className="mr-2" />
              加载中...
            </div>
          ) : posts.length > 0 ? (
            <>
              {posts.map((post) => {
                const postView = getPostLikeView(post);
                return (
                  <PostCard
                    key={postView.id}
                    post={postView}
                    onOpen={() => openPost(post)}
                    previewMode
                    liked={postView.isLiked}
                    bookmarked={postView.isSaved}
                    onLike={() => toggleLike(post.id)}
                    onBookmark={() => toggleBookmark(post.id)}
                    onReport={handleReport}
                  />
                );
              })}
              {currentPage < totalPages && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => loadMorePosts()}
                    disabled={loadingMore}
                    className="secondary-button w-full disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? '加载中...' : '加载更多'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title={query ? '没有找到相关树洞' : '树洞里暂时没有相关话题'}
              description={query ? '试试换个关键词。' : '发布第一条树洞吧！'}
            />
          )}
        </div>
      </section>
      <aside className="self-start">
        <div className="sticky top-[80px] grid gap-4 max-lg:static max-lg:grid-cols-3 max-sm:grid-cols-1">
          <DailyFortune userId={userId} showToast={showToast} />
        </div>
      </aside>
    </div>
  );
}
