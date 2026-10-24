import React, { useState, useRef } from 'react';
import ClickableImage from './ClickableImage';
import Icon from './Icon';
import ExpandableText from './ExpandableText';
import ReportModal from '../features/ReportModal';
import TimeAgo from './TimeAgo';
import ConfirmLeaveDialog from './ConfirmLeaveDialog';
import { getDisplayName } from '../../utils';
import useCommentStore from '../../store/commentStore';
import ResponseInput from './ResponseInput';

// ─── Stable store selectors ───
const selectToggleLike = (s) => s.toggleLike;

function normalizeOwnerId(ownerUserId) {
  return typeof ownerUserId === 'object' ? ownerUserId?.toString() : ownerUserId;
}

function Comment({ comment, postId, currentUserId, onReply, onDelete, onReport, onAuthorFilter, postOwnerId }) {
  const toggleLike = useCommentStore(selectToggleLike);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const replyInputRef = useRef(null);

  const displayName = comment.official ? '官方小助手' : getDisplayName(comment.ownerUserId, postId);
  const isOwner = normalizeOwnerId(comment.ownerUserId) === currentUserId;

  const handleLike = () => {
    toggleLike(comment.id || comment._id);
  };

  const handleReport = (targetId, reason) => {
    onReport(targetId, reason, 'comment');
    setShowReportModal(false);
  };

  const handleReplyClick = () => {
    setShowReplyInput(true);
    setTimeout(() => replyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const handleReplySubmit = async (content, image) => {
    await onReply(comment.id || comment._id, content, image);
    setShowReplyInput(false);
  };

  return (
    <>
      <article className={`comment ${comment.official ? 'official' : ''} flex gap-[12px] max-sm:gap-2 relative`}>
        <div className="anon-avatar small grid w-[34px] h-[34px] max-sm:w-7 max-sm:h-7 flex-none place-items-center border border-line rounded-[8px] bg-surface-soft text-text-3">
          <Icon name={comment.official ? 'verified_user' : 'person'} />
        </div>
        <div className="comment-body flex-1 p-4 max-sm:p-3 rounded-md border border-line-soft bg-surface">
          <div className="comment-meta flex items-center justify-between gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <div>
                <button type="button" className="comment-author" onClick={() => onAuthorFilter?.(comment.ownerUserId)} aria-label={`只看 ${displayName}`}>{displayName}</button>
                {postOwnerId && comment.ownerUserId === postOwnerId && <span className="author-badge">洞主</span>}
                <TimeAgo timeString={comment.createdAt} compact className="block mt-0.5 text-text-3 text-xs" />
              </div>
              {comment.official && <span className="pill blue text-[10px] px-[2px_6px]">官方</span>}
            </div>
            {onReport && (
              <button
                className="flex-shrink-0 grid w-7 h-7 place-items-center border-0 rounded-full bg-transparent text-text-3 hover:bg-black/5 hover:text-text transition-colors duration-150"
                onClick={() => setShowReportModal(true)}
                type="button"
                aria-label="举报"
              >
                <Icon name="report_problem" style={{ fontSize: '14px' }} />
              </button>
            )}
          </div>
          {comment.content && (
            <ExpandableText
              className="my-[9px]"
              content={comment.content}
              collapsedLinesClass="line-clamp-8"
              charThreshold={220}
              lineThreshold={8}
            />
          )}
          {comment.image && (
            <div className="comment-image-preview mt-2">
              <ClickableImage
                src={comment.image}
                alt="comment"
                className="max-w-full max-h-80 rounded-md object-cover"
              />
            </div>
          )}
          <div className="comment-actions flex gap-[14px] max-sm:gap-2 text-text-3 text-xs font-semibold">
            <button type="button" onClick={handleReplyClick}>回复</button>
            <button type="button" onClick={handleLike} className={`inline-flex items-center gap-1 transition-colors duration-150 ${comment.isLiked ? 'text-red' : 'hover:text-red'}`}>
              <Icon name={comment.isLiked ? 'favorite' : 'favorite_border'} /> {comment.likes}
            </button>
            {isOwner && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-red"
              >
                <Icon name="delete" style={{ fontSize: '14px' }} /> 删除
              </button>
            )}
          </div>

          {/* 评论下方的回复输入框 */}
          {showReplyInput && (
            <ResponseInput
              draftKey={`reply-${postId}-${comment.id || comment._id}`}
              autoFocus
              label={`回复 ${displayName}`}
              placeholder={`回复 ${displayName}…`}
              submitLabel="发送回复"
              onSubmit={handleReplySubmit}
              onCancel={() => setShowReplyInput(false)}
            />
          )}
        </div>
      </article>

      {showReportModal && (
        <ReportModal
          targetId={comment.id}
          targetType="comment"
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
        />
      )}

      <ConfirmLeaveDialog
        open={showDeleteConfirm}
        title="删除评论"
        description="确定要删除这条评论吗？此操作不可撤销。"
        confirmText="确认删除"
        cancelText="取消"
        mode="discard"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(comment.id || comment._id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

export default Comment;
