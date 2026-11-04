import PageHeader from '../common/PageHeader';
import React, { useCallback, useEffect, useState } from 'react';
import TimeAgo from '../common/TimeAgo';
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
  const [deleteError, setDeleteError] = useState('');
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
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deletePost(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error.message || '删除失败，请重试。');
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
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-text-2 transition-colors duration-150 hover:text-text hover:border-blue/40"
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
          <section className="personal-post-list">
            {filteredPosts.map((post) => {
              const isOwner = currentUserId && post.ownerUserId === currentUserId;
              return (
                <div
                  key={post.id}
                  className="personal-post-row"
                >
                  <div className="personal-post-copy">
                    <button type="button" className="row-title" onClick={() => handleOpenPost(post)}>{post.title}</button>
                    <p className="row-preview">{post.content}</p>
                    <div className="personal-post-metadata">
                      <TimeAgo compact timeString={post.createdAt} />
                      <span className="inline-flex items-center gap-1">
                        <Icon name="favorite" /> {post.likes || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="chat_bubble" /> {post.comments || 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="bookmark" /> {post.saves || 0}
                      </span>
                      {isOwner && <button className="row-delete" onClick={() => { setDeleteError(''); setDeleteTarget(post); }} type="button" aria-label={`删除帖子：${post.title}`}><Icon name="delete" /><span>删除</span></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </>
    );
  };

  return (
    <div className="collection-page my-posts-page">
      {!compact && (
        <PageHeader title="我的帖子" description="查看和管理你发布的树洞。" />
      )}
      {renderContent()}
      <ConfirmLeaveDialog
        open={!!deleteTarget}
        title="删除帖子"
        description={`“${deleteTarget?.title || '无标题'}”删除后无法恢复。`}
        error={deleteError}
        confirmText={deleting ? '删除中...' : '确认删除'}
        cancelText="取消"
        mode="discard"
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default MyPostsPage;
