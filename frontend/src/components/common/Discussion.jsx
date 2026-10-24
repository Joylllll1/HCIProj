import React, { useEffect, useState } from 'react';
import Comment from './Comment';
import Select from './Select';
import ReplyCard from './ReplyCard';
import ResponseInput from './ResponseInput';
import useCommentStore from '../../store/commentStore';
import useUiStore from '../../store/uiStore';
import { getDisplayName } from '../../utils';

export default function Discussion({ post, currentUserId, onComment, onReply, onDeleteComment, onDeleteReply, onReport }) {
  const [sort, setSort] = useState('time');
  const [author, setAuthor] = useState('');
  // Subscribe to data, not just the stable getter, so inline discussions update too.
  const state = useCommentStore();
  const flat = state.getFlatComments(post.id);
  const status = state.loadStates[post.id];
  useEffect(() => { useCommentStore.getState().fetchComments(post.id); }, [post.id]);
  const authors = [...new Set(flat.map((item) => item.ownerUserId).filter(Boolean))];
  const visible = flat.filter((item) => !author || item.ownerUserId === author).sort((a, b) => (
    (sort === 'likes' ? (b.likes || 0) - (a.likes || 0) : 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
  ));
  const remove = async (reply, ...ids) => {
    const showToast = useUiStore.getState().showToast;
    try {
      await (reply ? state.deleteReply : state.deleteComment)(...ids);
      showToast(reply ? '回复已删除' : '评论已删除');
    } catch (err) { showToast(err.message || '删除失败，请重试。'); }
  };
  const actions = {
    onReply: onReply || ((id, text, image, replyToId) => state.addReply(id, text, image, false, replyToId)),
    onDelete: onDeleteComment || ((id) => remove(false, id)),
    onReport,
    currentUserId,
    postId: post.id,
    postOwnerId: post.ownerUserId,
    onAuthorFilter: setAuthor,
  };
  return (
    <section className="discussion" aria-label="树洞讨论">
      <div className="discussion-toolbar">
        <h2>全部评论 ({flat.length})</h2>
        <div className="discussion-sort">
          {[['time', '按时间'], ['likes', '按热度']].map(([value, label]) => <button type="button" key={value} aria-pressed={sort === value} onClick={() => setSort(value)}>{label}</button>)}
        </div>
      </div>
      <div className="discussion-filters">
        <button type="button" aria-pressed={Boolean(author && author === post.ownerUserId)} disabled={!post.ownerUserId} onClick={() => setAuthor(author === post.ownerUserId ? '' : post.ownerUserId)}>只看洞主</button>
        <Select aria-label="按评论者筛选" value={author} onChange={setAuthor} options={[
          { value: '', label: '所有评论者' },
          ...[...new Set([post.ownerUserId, ...authors].filter(Boolean))].map(id => ({ value: id, label: id === post.ownerUserId ? '洞主' : getDisplayName(id, post.id) })),
        ]} />
        {author && <button type="button" onClick={() => setAuthor('')}>清除筛选</button>}
      </div>
      {status?.error && <div className="inline-error" role="alert">{status.error} <button type="button" onClick={() => state.fetchComments(post.id)}>重试加载评论</button></div>}
      {status?.loading && !flat.length && <p role="status" className="discussion-empty">正在加载评论…</p>}
      <div className="comment-list">
        {visible.map((item) => item.itemType === 'reply'
          ? <ReplyCard key={`reply-${item.id || item._id}`} reply={item} {...actions} onDelete={onDeleteReply || ((id, replyId) => remove(true, id, replyId))} />
          : <Comment key={`comment-${item.id || item._id}`} comment={item} {...actions} />)}
      </div>
      {!visible.length && !status?.loading && !status?.error && <p className="discussion-empty">{author ? '这位同学还没有参与讨论。' : '还没有评论，来聊聊吧。'}</p>}
      <ResponseInput draftKey={`comment-${post.id}`} onSubmit={onComment || ((text, image) => state.addComment(post.id, text, image))} />
    </section>
  );
}
