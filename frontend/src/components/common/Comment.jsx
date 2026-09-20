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
const selectToggleLike = (s) => s.toggleLike;

function normalizeOwnerId(ownerUserId) {
  return typeof ownerUserId === 'object' ? ownerUserId?.toString() : ownerUserId;
}

function Comment({ comment, postId, currentUserId, onReply, onDelete, onReport }) {
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

  const handleReplySubmit = (content, image) => {
    onReply(comment.id || comment._id, content, image);
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
                <strong className="text-sm">{displayName}</strong>
                <TimeAgo timeString={comment.createdAt} className="block mt-0.5 text-text-3 text-xs" />
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
            <CommentReplyInput
              ref={replyInputRef}
              replyToName={displayName}
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

// 评论下方的回复输入框
const CommentReplyInput = React.forwardRef(({ replyToName, onSubmit, onCancel }, ref) => {
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
    <div ref={ref} className="comment-reply-input mt-3 p-[14px] max-sm:p-3 rounded-md border border-blue bg-blue-soft">
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

CommentReplyInput.displayName = 'CommentReplyInput';

export default Comment;
