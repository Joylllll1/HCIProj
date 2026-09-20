import React, { useState, useRef } from 'react';
import ClickableImage from './ClickableImage';
import Icon from './Icon';
import ExpandableText from './ExpandableText';
import ReportModal from '../features/ReportModal';
import TimeAgo from './TimeAgo';
import ConfirmLeaveDialog from './ConfirmLeaveDialog';
import { getDisplayName } from '../../utils';
import useCommentStore from '../../store/commentStore';
import { fileToOptimizedDataUrl } from '../../utils/image';

// ─── Stable store selectors ───
const selectToggleReplyLike = (s) => s.toggleReplyLike;

function normalizeOwnerId(ownerUserId) {
  return typeof ownerUserId === 'object' ? ownerUserId?.toString() : ownerUserId;
}

function ReplyCard({ reply, postId, currentUserId, onReply, onDelete, onReport }) {
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

  const handleReplySubmit = (content, image) => {
    const commentId = reply.parentId;
    const replyToId = reply.id || reply._id;
    onReply(commentId, content, image, replyToId);
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
          <div className="quoted-content p-2 mb-3 rounded-md bg-[#f5f5f5] border border-[#e0e0e0] text-text-2 text-sm">
            <div>
              <strong className="text-text text-sm">{parentAuthorName}</strong>
              <TimeAgo timeString={reply.parentTime} className="block mt-0.5 text-text-3 text-xs" />
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
                <strong className="text-sm">{replyName}</strong>
                <TimeAgo timeString={reply.createdAt} className="block mt-0.5 text-text-3 text-xs" />
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
            <ReplyInput
              ref={replyInputRef}
              replyToName={replyName}
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

// 回复输入框组件
const ReplyInput = React.forwardRef(({ replyToName, onSubmit, onCancel }, ref) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [image, setImage] = useState('');
  const fileRef = useRef(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, [ref]);

  const EMOJI_LIST = ['😊', '😂', '🥺', '😭', '❤️', '👍', '🎉', '🤔', '💪', '✨', '🙏', '😅', '🥰', '😢', '😤', '🤝', '💯', '🔥', '👀', '💕'];

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    fileToOptimizedDataUrl(file)
      .then((url) => {
        setImage(url);
      })
      .catch(() => {});

    e.target.value = '';
  };

  const handleSubmit = () => {
    if (!text.trim() && !image) return;
    onSubmit(text.trim(), image);
    setText('');
    setImage('');
  };

  return (
    <div ref={ref} className="reply-input mt-3 p-[14px] max-sm:p-3 rounded-md border border-blue bg-blue-soft">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue font-semibold">回复 {replyToName}</span>
        <button type="button" className="text-text-3 hover:text-text" onClick={onCancel}>取消</button>
      </div>
      <textarea
        className="w-full min-h-[60px] border border-line-soft rounded-md p-2 bg-white outline-0 resize-y text-text"
        placeholder={`回复 ${replyToName}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {image && (
        <div className="comment-image-preview relative mt-2.5">
          <img src={image} alt="preview" className="max-w-[200px] max-h-[150px] rounded-md object-cover" />
          <button type="button" className="comment-image-remove absolute top-1.5 left-1.5 grid w-6 h-6 place-items-center px-0 py-0 border-0 rounded-full bg-black/60 text-white text-base cursor-pointer" onClick={() => setImage('')}>&times;</button>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 mt-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="toolbar-btn grid w-8 h-8 place-items-center px-0 py-0 border-0 rounded-md bg-transparent text-text-3 cursor-pointer transition-colors duration-150 hover:bg-white hover:text-blue"
            onClick={() => setShowEmoji(!showEmoji)}
            aria-label="表情"
          >
            <Icon name="sentiment_satisfied" />
          </button>
          <button
            type="button"
            className="toolbar-btn grid w-8 h-8 place-items-center px-0 py-0 border-0 rounded-md bg-transparent text-text-3 cursor-pointer transition-colors duration-150 hover:bg-white hover:text-blue"
            onClick={() => fileRef.current?.click()}
            aria-label="图片"
          >
            <Icon name="image" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </div>
        {showEmoji && (
          <div className="emoji-picker absolute mt-8 flex flex-wrap gap-1 p-2.5 border border-line rounded-sm bg-white shadow-sm z-10">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                className="emoji-item w-8 h-8 grid place-items-center px-0 py-0 border-0 rounded-md bg-transparent text-lg cursor-pointer transition-colors duration-150 hover:bg-surface-soft"
                onClick={() => {
                  setText((prev) => prev + emoji);
                  setShowEmoji(false);
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          type="button"
          disabled={!text.trim() && !image}
        >
          发送回复
        </button>
      </div>
    </div>
  );
});

ReplyInput.displayName = 'ReplyInput';

export default ReplyCard;
