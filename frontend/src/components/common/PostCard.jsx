import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import ClickableImage from './ClickableImage';
import PlainTextContent from './PlainTextContent';
import ReportModal from '../features/ReportModal';
import TimeAgo from './TimeAgo';
import { getDisplayName, formatCount } from '../../utils';
import { getImageGridLayout } from '../../utils/image';

function PostCard({
  post,
  onOpen,
  compact = false,
  liked,
  bookmarked,
  onLike,
  onBookmark,
  onReport,
  previewMode = false,
}) {
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
  const imageLayout = getImageGridLayout(images.length);
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
      <article className={`post-card ${compact ? 'compact' : ''} relative overflow-hidden rounded-md border border-line-soft bg-surface shadow-sm transition-transform duration-150 hover:-translate-y-px hover:shadow-sm`}>
        <div className="block w-full p-[18px_20px_14px] max-sm:p-3 cursor-pointer" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
          <div className="post-header flex items-start justify-between gap-3.5 max-sm:gap-2.5 mb-4 max-sm:mb-3">
            <div className="user-block flex items-center gap-[11px] max-sm:gap-2">
              <div className="anon-avatar grid w-[38px] h-[38px] max-sm:w-8 max-sm:h-8 flex-none place-items-center border border-line rounded-[10px] bg-surface-soft text-text-3">
                <Icon name="person" />
              </div>
              <div>
                <strong className="block text-sm">{authorName}</strong>
                <TimeAgo timeString={post.createdAt} className="block mt-0.5 text-text-3 text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`mood mood-${post.moodType} inline-flex items-center gap-[5px] w-fit rounded-full px-[10px] py-2 text-xs font-semibold leading-none border border-transparent`}>{post.mood}</span>
              {onReport && (
                <button
                  className="flex-shrink-0 grid w-8 h-8 place-items-center border-0 rounded-full bg-transparent text-text-3 hover:bg-black/5 hover:text-text transition-colors duration-150"
                  onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                  type="button"
                  aria-label="举报"
                >
                  <Icon name="report_problem" />
                </button>
              )}
            </div>
          </div>
          <h3 className={`m-0 mb-2 leading-snug tracking-tight ${compact ? 'text-[19px]' : 'text-xl max-sm:text-base'}`}>{post.title}</h3>
          {post.content && (
            <div>
              <PlainTextContent
                ref={contentRef}
                className={`m-0 text-[15px] max-sm:text-[13px] leading-relaxed text-[#344054] ${previewMode ? previewClampClass : ''}`}
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
          {images.length > 0 && (
            <div className={`post-images mt-3.5 grid gap-1.5 max-sm:grid-cols-1 ${imageLayout.gridClass}`}>
              {images.map((src, index) => (
                <div key={`${src}-${index}`} className={`overflow-hidden rounded-md bg-surface-soft ${imageLayout.itemClass} ${images.length === 1 ? 'justify-self-start w-fit max-w-full' : ''}`}>
                  <ClickableImage
                    src={src}
                    alt={`${post.title || '帖子'} 图片 ${index + 1}`}
                    className={images.length === 1 ? 'block h-auto max-h-[400px] max-w-full object-contain' : 'h-full w-full object-cover'}
                    wrapperClassName={images.length === 1 ? 'inline-block max-w-full align-top' : 'block w-full'}
                    images={images}
                    imageIndex={index}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="post-footer flex items-center justify-between gap-3.5 max-sm:gap-2 px-5 max-sm:px-3 py-[10px_20px_14px] max-sm:py-2 border-t border-line-soft bg-[#fafbfc]">
          <div className="tag-row flex flex-wrap gap-2.5 max-sm:gap-1.5 text-text-3 text-xs font-semibold">
            {tags.map((tag) => (
              <span key={tag} className="text-blue">#{tag}</span>
            ))}
          </div>
          <div className="metrics flex flex-wrap gap-2.5 max-sm:gap-2 text-text-3 text-xs font-semibold">
            <span className={`metric-btn cursor-pointer transition-colors duration-150 hover:scale-108 ${liked ? 'active text-red' : ''}`} onClick={(e) => { e.stopPropagation(); onLike(); }}>
              <Icon name={liked ? 'favorite' : 'favorite_border'} /> {formatCount(post.likes)}
            </span>
            <span className="metric-btn cursor-pointer transition-transform duration-150 hover:scale-108" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
              <Icon name="chat_bubble" /> {formatCount(post.comments)}
            </span>
            <span className={`metric-btn cursor-pointer transition-transform duration-150 hover:scale-108 ${bookmarked ? 'active text-blue' : ''}`} onClick={(e) => { e.stopPropagation(); onBookmark(); }}>
              <Icon name={bookmarked ? 'bookmark' : 'bookmark_border'} /> {formatCount(post.saves)}
            </span>
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
