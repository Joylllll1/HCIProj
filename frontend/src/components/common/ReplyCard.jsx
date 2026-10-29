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
const selectToggleReplyLike = (s) => s.toggleReplyLike;

function normalizeOwnerId(ownerUserId) {
  return typeof ownerUserId === 'object' ? ownerUserId?.toString() : ownerUserId;
}

function ReplyCard({ reply, postId, currentUserId, onReply, onDelete, onReport, onAuthorFilter, postOwnerId }) {
  const toggleReplyLike = useCommentStore(selectToggleReplyLike);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const replyInputRef = useRef(null);

  const replyName = reply.official ? '官方小助手' : getDisplayName(reply.ownerUserId, postId);
  const parentAuthorName = reply.parentOfficial ? '官方小助手' : getDisplayName(reply.parentAuthorId, postId);
  const isOwner = normalizeOwnerId(reply.ownerUserId) === currentUserId;

  const handleLike = () => {
    const commentId = reply.parentId;
    const replyId = reply.id || reply._id;
    toggleReplyLike(commentId, replyId);
  };

  const handleReport = (targetId, reason) => {
    onReport(targetId, reason, 'reply');
    setShowReportModal(false);
  };

  const handleReplyClick = () => {
    setShowReplyInput(true);
    setTimeout(() => replyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const handleReplySubmit = async (content, image) => {
    const commentId = reply.parentId;
    const replyToId = reply.id || reply._id;
    await onReply(commentId, content, image, replyToId);
    setShowReplyInput(false);
  };

  return (
    <>
      <article className="reply-card flex gap-[12px] max-sm:gap-2 relative">
        <div className="anon-avatar small grid w-[34px] h-[34px] max-sm:w-7 max-sm:h-7 flex-none place-items-center border border-line rounded-[8px] bg-surface-soft text-text-3">
          <Icon name={reply.official ? 'verified_user' : 'person'} />
        </div>
        <div className="reply-body flex-1 p-4 max-sm:p-3 rounded-md border border-line-soft bg-surface">
          {/* 被回复内容引用 */}
          <div className="quoted-content p-2 mb-3 rounded-md bg-surface-soft border border-line text-text-2 text-sm">
            <div>
              <strong className="text-text text-sm">{parentAuthorName}</strong>
              <TimeAgo timeString={reply.parentTime} compact className="block mt-0.5 text-text-3 text-xs" />
            </div>
            <div className="mt-2">
              <ExpandableText
                as="div"
                className="text-sm"
                content={reply.parentContent}
                collapsedLinesClass="line-clamp-2"
                charThreshold={60}
                lineThreshold={3}
              />
            </div>
          </div>

          {/* 回复内容 */}
          <div className="reply-meta flex items-center justify-between gap-[8px] mb-2">
            <div className="flex items-center gap-[8px]">
              <div>
                <button type="button" className="comment-author" onClick={() => onAuthorFilter?.(reply.ownerUserId)} aria-label={`只看 ${replyName}`}>{replyName}</button>
                {postOwnerId && reply.ownerUserId === postOwnerId && <span className="author-badge">洞主</span>}
                <TimeAgo timeString={reply.createdAt} compact className="block mt-0.5 text-text-3 text-xs" />
              </div>
              {reply.official && <span className="pill blue text-[10px] px-[2px_6px]">官方</span>}
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
          {reply.content && (
            <ExpandableText
              className="my-[9px]"
              content={`回复 ${parentAuthorName}: ${reply.content}`}
              collapsedLinesClass="line-clamp-5"
              charThreshold={140}
              lineThreshold={5}
            />
          )}
          {reply.image && (
            <div className="comment-image-preview mt-2">
              <ClickableImage
                src={reply.image}
                alt="reply"
                className="max-w-full max-h-80 rounded-md object-cover"
              />
            </div>
          )}
          <div className="reply-actions flex gap-[14px] max-sm:gap-2 text-text-3 text-xs font-semibold">
            <button type="button" onClick={handleReplyClick}>回复</button>
            <button
              type="button"
              onClick={handleLike}
              className={`inline-flex items-center gap-1 transition-colors duration-150 ${reply.isLiked ? 'text-red' : 'hover:text-red'}`}
            >
              <Icon name={reply.isLiked ? 'favorite' : 'favorite_border'} /> {reply.likes || 0}
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

          {/* 回复输入框 - 显示在回复卡片正下方 */}
          {showReplyInput && (
            <ResponseInput
              draftKey={`reply-${postId}-${reply.id || reply._id}`}
              autoFocus
              label={`回复 ${replyName}`}
              placeholder={`回复 ${replyName}…`}
              submitLabel="发送回复"
              onSubmit={handleReplySubmit}
              onCancel={() => setShowReplyInput(false)}
            />
          )}
        </div>
      </article>

      {showReportModal && (
        <ReportModal
          targetId={reply.id}
          targetType="reply"
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
        />
      )}

      <ConfirmLeaveDialog
        open={showDeleteConfirm}
        title="删除回复"
        description="确定要删除这条回复吗？此操作不可撤销。"
        confirmText="确认删除"
        cancelText="取消"
        mode="discard"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(reply.parentId, reply.id || reply._id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

export default ReplyCard;
