import React, { useRef, useState } from 'react';
import Icon from '../common/Icon';
import PostCard from '../common/PostCard';
import Discussion from '../common/Discussion';
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';

function DetailPage({
  post,
  liked,
  bookmarked,
  isOwner,
  currentUserId,
  onLike,
  onBookmark,
  onComment,
  onReply,
  onDeleteComment,
  onDeleteReply,
  onDelete,
  onNavigate,
  onReport,
}) {
  const primaryTag = post.tags?.[0] || '未分类';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deletingRef = useRef(false);
  const deletePost = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true); setDeleteError('');
    try { await onDelete(post.id); setShowDeleteConfirm(false); }
    catch (error) { setDeleteError(error.message || '删除失败，请重试。'); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }

    onNavigate('home');
  };

  return (
    <div className="detail-layout max-w-[1180px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-full bg-surface text-text-2 text-sm font-semibold shadow-xs transition-all duration-150 hover:-translate-y-px hover:shadow-sm hover:text-blue hover:border-blue"
          onClick={handleBack}
          type="button"
        >
          <Icon name="arrow_back" size="18" />
          返回
        </button>
      </div>
      <section className="detail-card p-[18px] max-sm:p-3 rounded-lg border border-line-soft bg-surface shadow-sm">
        <div className="breadcrumb mb-[14px] text-text-3 text-[13px] font-semibold">
          <span>/ {primaryTag} / 帖子详情</span>
        </div>
        <PostCard
          post={post}
          detail
          onOpen={() => document.getElementById('discussion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          liked={liked}
          bookmarked={bookmarked}
          onLike={onLike}
          onBookmark={onBookmark}
          onReport={onReport}
        />
        {isOwner && (
          <div className="owner-tools flex items-center gap-3 max-sm:flex-col max-sm:items-stretch mt-4 p-3 rounded-md bg-surface-tint">
            <Icon name="shield_person" />
            <div className="flex-1">
              <strong className="text-sm font-bold">帖主管理</strong>
              <span className="text-text-2 text-[13px]">你可以管理这篇帖子</span>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 border-0 rounded-full text-white bg-red text-sm font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              onClick={() => { setDeleteError(''); setShowDeleteConfirm(true); }}
              type="button"
            >
              <Icon name="delete" />
              删除帖子
            </button>
          </div>
        )}
      </section>

      <div id="discussion"><Discussion post={post} currentUserId={currentUserId} onComment={onComment} onReply={onReply} onDeleteComment={onDeleteComment} onDeleteReply={onDeleteReply} onReport={onReport} /></div>

      <ConfirmLeaveDialog
        open={showDeleteConfirm}
        title="删除帖子"
        description={`“${post.title || '无标题'}”删除后无法恢复。`}
        error={deleteError}
        confirmText={deleting ? '删除中…' : '确认删除'}
        cancelText="取消"
        mode="discard"
        pending={deleting}
        onConfirm={deletePost}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default DetailPage;
