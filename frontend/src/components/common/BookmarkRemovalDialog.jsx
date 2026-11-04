import React from 'react';
import BookmarkActionDialog from './BookmarkActionDialog';

export default function BookmarkRemovalDialog({ titles, pending, onCancel, onConfirm, message }) {
  return (
    <BookmarkActionDialog title={`取消收藏 ${titles.length} 篇？`} pending={pending} onCancel={onCancel}
      onConfirm={onConfirm} confirmText={pending ? '正在取消…' : '确认取消'} message={message} />
  );
}
