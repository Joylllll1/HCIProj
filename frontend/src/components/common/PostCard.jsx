import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import PostImages from './PostImages';
import PlainTextContent from './PlainTextContent';
import ReportModal from '../features/ReportModal';
import TimeAgo from './TimeAgo';
import useUiStore from '../../store/uiStore';
import { getDisplayName, formatCount } from '../../utils';

function PostCard({
  post,
  onOpen,
  onDiscuss,
  expanded,
  compact = false,
  detail = false,
  liked,
  bookmarked,
  onLike,
  onBookmark,
  onReport,
  previewMode = false,
}) {
  const Heading = detail ? 'h1' : 'h3';
  const [showReportModal, setShowReportModal] = useState(false);
  const [shouldShowPreviewLink, setShouldShowPreviewLink] = useState(false);
  const contentRef = useRef(null);
  const authorName = getDisplayName(post.ownerUserId, post.id);
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
      ? [post.image]
      : [];
  const hasImages = images.length > 0;
  const previewClampClass = hasImages ? 'line-clamp-4' : 'line-clamp-6';

  useEffect(() => {
    if (!previewMode || !post.content) {
      setShouldShowPreviewLink(false);
      return;
    }

    const element = contentRef.current;
    if (!element) {
      setShouldShowPreviewLink(false);
      return;
    }

    const measureOverflow = () => {
      const overflowY = element.scrollHeight - element.clientHeight > 1;
      const overflowX = element.scrollWidth - element.clientWidth > 1;
      setShouldShowPreviewLink(overflowY || overflowX);
    };

    measureOverflow();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measureOverflow);
      return () => window.removeEventListener('resize', measureOverflow);
    }

    return undefined;
  }, [previewMode, post.content, previewClampClass]);

  const handleReport = (targetId, reason) => {
    onReport(targetId, reason, 'post');
    setShowReportModal(false);
  };

  return (
    <>
      <article className={`post-card ${compact ? 'compact' : ''} ${detail ? 'post-detail' : ''}`}>
        <div className="post-main" onClick={detail ? undefined : onOpen}>
          <div className="post-header">
            <div className="user-block">
              <div className="anon-avatar">
                <Icon name="person" />
              </div>
              <div>
                <strong className="block text-sm">{authorName}</strong>
                <TimeAgo compact timeString={post.createdAt} className="block mt-0.5 text-text-3 text-xs" />
              </div>
            </div>
            {post.mood && <span className={`mood mood-${post.moodType}`}>{post.mood}</span>}
          </div>
          <Heading className="post-title">
            {detail ? (post.title || '一条树洞') : (
              <button
                className="post-title-link"
                type="button"
                onClick={(event) => { event.stopPropagation(); onOpen(); }}
                aria-label={`查看树洞：${post.title || '无标题'}`}
              >
                {post.title || '一条树洞'}
              </button>
            )}
          </Heading>
          {post.content && (
            <div>
              <PlainTextContent
                ref={contentRef}
                className={`post-body m-0 ${previewMode ? previewClampClass : ''}`}
                whitespaceClassName={previewMode ? 'whitespace-pre-line' : 'whitespace-pre-wrap'}
                content={post.content}
              />
              {shouldShowPreviewLink && (
                <button
                  type="button"
                  className="mt-2 inline-flex text-sm font-semibold text-blue hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                >
                  查看全文
                </button>
              )}
            </div>
          )}
          {images.length > 0 && <PostImages images={images} title={post.title} />}
        </div>
        <div className="post-footer">
          <div className="tag-row">
            {tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
          <button className="post-report" type="button" aria-label="复制树洞链接" onClick={async () => {
            const url = new URL(`/detail/${post.id}`, window.location.origin);
            if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) url.searchParams.set('preview', '1');
            try { await navigator.clipboard.writeText(url.href); useUiStore.getState().showToast('链接已复制'); }
            catch { useUiStore.getState().showToast('复制失败，请打开树洞后复制地址栏链接'); }
          }}><Icon name="link" /></button>
          {onReport && (
            <button
              className="post-report"
              onClick={() => setShowReportModal(true)}
              type="button"
              aria-label="举报"
            >
              <Icon name="report_problem" />
            </button>
          )}
          <div className="metrics">
            <button type="button" aria-label={liked ? '取消点赞' : '点赞'} aria-pressed={Boolean(liked)} className="metric-btn" onClick={onLike}>
              <Icon name={liked ? 'favorite' : 'favorite_border'} /> {formatCount(post.likes)}
            </button>
            <button type="button" id={`discuss-${post.id}`} aria-label={expanded ? '收起评论' : '查看评论'} aria-expanded={onDiscuss ? Boolean(expanded) : undefined} aria-controls={onDiscuss ? `discussion-${post.id}` : undefined} className="metric-btn" onClick={onDiscuss || onOpen}>
              <Icon name="chat_bubble" /> {formatCount(post.comments)}
            </button>
            {onBookmark && <button type="button" aria-label={bookmarked ? '取消收藏' : '收藏'} aria-pressed={Boolean(bookmarked)} className="metric-btn" onClick={onBookmark}>
              <Icon name={bookmarked ? 'bookmark' : 'bookmark_border'} /> {formatCount(post.saves)}
            </button>}
          </div>
        </div>
      </article>

      {showReportModal && (
        <ReportModal
          targetId={post.id}
          targetType="post"
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
        />
      )}
    </>
  );
}

export default PostCard;
