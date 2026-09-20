import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../common/Icon';
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';
import EmptyState from '../common/EmptyState';
import usePostStore from '../../store/postStore';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import { hasSearchQuery, matchPostQuery } from '../../utils/search';

function MyPostsPage({ compact, onNavigate }) {
  const myPosts = usePostStore((s) => s.myPosts);
  const fetchMyPosts = usePostStore((s) => s.fetchMyPosts);
  const deletePost = usePostStore((s) => s.deletePost);
  const setSelectedPost = usePostStore((s) => s.setSelectedPost);
  const currentUserId = useAuthStore((s) => s.user?._id);
  const query = useUiStore((s) => s.query);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadMyPosts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      await fetchMyPosts();
    } catch (error) {
      setLoadError(error?.message || '加载我的帖子失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [fetchMyPosts]);

  useEffect(() => {
    loadMyPosts();
  }, [loadMyPosts]);

  const handleOpenPost = (post) => {
    setSelectedPost(post);
    onNavigate('detail', { selectedPost: post });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Keep dialog open so the user can retry or cancel.
    } finally {
      setDeleting(false);
    }
  };

  const searching = hasSearchQuery(query);
  const filteredPosts = myPosts.filter((post) => matchPostQuery(post, query));

  const renderContent = () => {
    if (loading) {
      return (
        <section className="grid place-items-center rounded-md border border-line bg-surface p-12 text-center text-text-2">
          正在加载你的帖子...
        </section>
      );
    }

    if (loadError) {
      return (
        <section className="grid gap-4 place-items-center rounded-md border border-line bg-surface p-12 text-center">
          <div>
            <h3 className="m-0 text-text">加载失败</h3>
            <p className="mt-2 mb-0 text-text-2">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={loadMyPosts}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text-2 transition-colors duration-150 hover:text-text hover:border-blue/40"
          >
            重试
          </button>
        </section>
      );
    }

    if (myPosts.length === 0) {
      return (
        <EmptyState
          title="还没有发布过帖子"
          description="去首页发布你的第一篇帖子吧"
        />
      );
    }

    return (
      <>
        {searching && (
          <p className="result-hint mt-6 mb-[14px] text-text-2 text-sm">
            搜索 &quot;{query}&quot; 找到 {filteredPosts.length} 条相关帖子。
          </p>
        )}

        {filteredPosts.length === 0 ? (
          <section className="mt-6">
            <EmptyState
              title={searching ? '没有找到匹配的帖子' : '还没有发布过帖子'}
              description={searching ? '换个关键词试试，比如标题、正文里的词或者标签。' : '去首页发布你的第一篇帖子吧'}
            />
          </section>
        ) : (
          <section className="grid gap-3 mt-6">
            {filteredPosts.map((post) => {
              const isOwner = currentUserId && post.ownerUserId === currentUserId;
              return (
                <div
                  key={post.id}
                  className="min-w-0 flex items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface backdrop-blur-sm shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                >
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleOpenPost(post)}>
                    <div className="font-semibold text-text truncate">{post.title}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-text-3">
                      <span>{post.time}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="favorite" style={{ fontSize: '14px' }} /> {post.likes || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="chat_bubble" style={{ fontSize: '14px' }} /> {post.comments || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="bookmark" style={{ fontSize: '14px' }} /> {post.saves || 0}
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-line rounded-full bg-white text-text-2 text-xs font-semibold transition-all duration-150 hover:border-red/40 hover:text-red hover:bg-red-soft/50"
                      onClick={() => setDeleteTarget(post)}
                      type="button"
                    >
                      <Icon name="delete" style={{ fontSize: '15px' }} />
                      删除
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </>
    );
  };

  return (
    <div className="collection-page max-w-[1180px] mx-auto">
      {!compact && (
        <section className="collection-hero">
          <div>
            <p className="eyebrow mb-[18px] text-blue text-xs font-bold tracking-widest uppercase">My Posts</p>
            <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">我的帖子</h1>
            <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">管理你发布的所有帖子。</p>
          </div>
        </section>
      )}
      {renderContent()}
      <ConfirmLeaveDialog
        open={!!deleteTarget}
        title="删除帖子"
        description="确定要删除这篇帖子吗？此操作不可撤销。"
        confirmText={deleting ? '删除中...' : '确认删除'}
        cancelText="取消"
        mode="discard"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default MyPostsPage;
