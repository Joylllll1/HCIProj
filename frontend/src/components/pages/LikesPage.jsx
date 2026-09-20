import React, { useState, useEffect } from 'react';
import PostCard from '../common/PostCard';
import EmptyState from '../common/EmptyState';
import Icon from '../common/Icon';
import ExpandableText from '../common/ExpandableText';
import useUiStore from '../../store/uiStore';
import usePostStore from '../../store/postStore';
import useCommentStore from '../../store/commentStore';
import { fetchLikes, fetchPostById } from '../../services/postService';
import { hasSearchQuery, matchLikedCommentQuery, matchPostQuery } from '../../utils/search';

const LIKES_PAGE_BATCH_SIZE = 20;

const selectTogglePendingPostUnlike = (s) => s.togglePendingUnlike;
const selectSubmitPendingPostUnlikes = (s) => s.submitPendingUnlikes;
const selectGetPostLikeView = (s) => s.getPostLikeView;
const selectPendingPostUnlikes = (s) => s.pendingUnlikePostIds;

const selectTogglePendingCommentUnlike = (s) => s.togglePendingUnlike;
const selectSubmitPendingCommentUnlikes = (s) => s.submitPendingCommentUnlikes;
const selectIsCommentPendingUnlike = (s) => s.isPendingUnlike;
const selectPendingCommentUnlikes = (s) => s.pendingCommentUnlikes;
const selectQuery = (s) => s.query;

function LikesPage({ compact, posts: allPosts, likedPosts: allLikedPosts, onOpenPost, onReport }) {
  const [activeTab, setActiveTab] = useState('posts');
  const [likesData, setLikesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visiblePostCount, setVisiblePostCount] = useState(LIKES_PAGE_BATCH_SIZE);
  const [visibleCommentCount, setVisibleCommentCount] = useState(LIKES_PAGE_BATCH_SIZE);
  const showToast = useUiStore((s) => s.showToast);
  const query = useUiStore(selectQuery);
  const pendingPostUnlikes = usePostStore(selectPendingPostUnlikes);
  const togglePendingPostUnlike = usePostStore(selectTogglePendingPostUnlike);
  const submitPendingPostUnlikes = usePostStore(selectSubmitPendingPostUnlikes);
  const getPostLikeView = usePostStore(selectGetPostLikeView);
  const pendingCommentUnlikes = useCommentStore(selectPendingCommentUnlikes);
  const togglePendingCommentUnlike = useCommentStore(selectTogglePendingCommentUnlike);
  const submitPendingCommentUnlikes = useCommentStore(selectSubmitPendingCommentUnlikes);
  const isCommentPendingUnlike = useCommentStore(selectIsCommentPendingUnlike);

  // 提交帖子取消点赞（带重试）
  const flushPendingPostUnlikes = async (postIds) => {
    const { succeeded, failed } = await submitPendingPostUnlikes(postIds);
    if (succeeded.length > 0) {
      setLikesData((prev) => {
        if (!prev) return prev;
        const removedIds = new Set(succeeded);
        return {
          ...prev,
          posts: prev.posts.filter((post) => !removedIds.has(post.id)),
        };
      });
    }
    if (failed.length > 0) {
      showToast('部分帖子取消点赞失败，已恢复原状态');
    }
  };

  // 提交评论取消点赞（带重试）
  const flushPendingCommentUnlikes = async (items) => {
    const { succeeded, failed } = await submitPendingCommentUnlikes(items);
    if (succeeded.length > 0) {
      const succeededKeys = new Set(succeeded);
      setLikesData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: prev.comments.filter((comment) => !succeededKeys.has(`${comment.type}-${comment.item?.id}`)),
        };
      });
    }
    if (failed.length > 0) {
      showToast('部分评论取消点赞失败，已恢复原状态');
    }
  };

  const flushAllPendingUnlikes = async () => {
    await flushPendingPostUnlikes(usePostStore.getState().pendingUnlikePostIds);
    await flushPendingCommentUnlikes(useCommentStore.getState().pendingCommentUnlikes);
  };

  // 刷新/关闭页面时同步提交
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 提交帖子取消点赞
      const postUnlikes = usePostStore.getState().pendingUnlikePostIds;
      if (postUnlikes.length > 0) {
        for (const postId of postUnlikes) {
          fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            keepalive: true,
          }).catch(() => {});
        }
      }

      // 提交评论取消点赞
      const commentUnlikes = useCommentStore.getState().pendingCommentUnlikes;
      if (commentUnlikes.length > 0) {
        for (const item of commentUnlikes) {
          const url = item.type === 'reply'
            ? `/api/comments/${item.parentId}/reply/${item.id}/like`
            : `/api/comments/${item.id}/like`;
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 离开组件时提交所有待取消的点赞（帖子 + 评论）
  useEffect(() => {
    return () => {
      const { pendingUnlikePostIds } = usePostStore.getState();
      const { pendingCommentUnlikes: currentPendingCommentUnlikes } = useCommentStore.getState();
      if (pendingUnlikePostIds.length > 0) {
        usePostStore.getState().submitPendingUnlikes(pendingUnlikePostIds);
      }
      if (currentPendingCommentUnlikes.length > 0) {
        useCommentStore.getState().submitPendingCommentUnlikes(currentPendingCommentUnlikes);
      }
    };
  }, []);

  const handleTabChange = async (newTab) => {
    // 切出当前 Tab 时提交
    if (activeTab === 'posts' && pendingPostUnlikes.length > 0) {
      await flushPendingPostUnlikes(pendingPostUnlikes);
    }
    if (activeTab === 'comments' && pendingCommentUnlikes.length > 0) {
      await flushPendingCommentUnlikes(pendingCommentUnlikes);
    }
    setActiveTab(newTab);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLikes()
      .then((data) => {
        setLikesData(data);
      })
      .catch((e) => {
        console.error('fetchLikes error:', e);
        if (e.status === 401) {
          setError('请先登录');
        } else {
          setError(e.message || '加载失败，请稍后重试');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePostUnlike = (postId) => {
    togglePendingPostUnlike(postId);
  };

  const handleCommentUnlike = (comment) => {
    togglePendingCommentUnlike({
      type: comment.type,
      id: comment.item?.id,
      parentId: comment.parentCommentId || null,
    });
  };

  const handleOpenCommentPost = async (comment) => {
    const postId = comment.postId;
    if (!postId) {
      showToast('该帖子不存在或已被删除');
      return;
    }

    const localPost = allPosts.find((post) => post.id === postId);
    const postIsDeleted = comment.postIsDeleted || localPost?.isDeleted || false;
    if (postIsDeleted) {
      showToast('该帖子已被删除');
      return;
    }

    try {
      await flushAllPendingUnlikes();
      const post = localPost || await fetchPostById(postId);
      onOpenPost(post);
    } catch {
      showToast('该帖子不存在或已被删除');
    }
  };

  const posts = (likesData?.posts || (allPosts || []).filter((p) => (allLikedPosts || []).includes(p.id))).map((post) =>
    getPostLikeView(post),
  );
  const comments = (likesData?.comments || []).map((c) => {
    const isPendingUnlike = isCommentPendingUnlike(c.type, c.item?.id);
    return {
      ...c,
      item: {
        ...c.item,
        likes: isPendingUnlike ? Math.max(0, (c.item?.likes || 0) - 1) : c.item?.likes,
        isLiked: !isPendingUnlike,
      },
    };
  });
  const filteredPosts = posts.filter((post) => matchPostQuery(post, query));
  const filteredComments = comments.filter((comment) => {
    const relatedPostTitle = comment.postId
      ? allPosts.find((post) => post.id === comment.postId)?.title
      : null;
    return matchLikedCommentQuery(comment, relatedPostTitle, query);
  });
  const searching = hasSearchQuery(query);
  const resultCount = activeTab === 'posts' ? filteredPosts.length : filteredComments.length;
  const visiblePosts = filteredPosts.slice(0, visiblePostCount);
  const visibleComments = filteredComments.slice(0, visibleCommentCount);

  useEffect(() => {
    setVisiblePostCount(LIKES_PAGE_BATCH_SIZE);
  }, [query, likesData?.posts, activeTab]);

  useEffect(() => {
    setVisibleCommentCount(LIKES_PAGE_BATCH_SIZE);
  }, [query, likesData?.comments, activeTab]);

  return (
    <div className="collection-page max-w-[1180px] mx-auto">
      {!compact && (
        <section className="collection-hero">
          <div>
            <p className="eyebrow mb-[18px] text-blue text-xs font-bold tracking-widest uppercase">My Likes</p>
            <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">我的喜爱</h1>
            <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">回顾你在树洞中点赞过的精彩内容。</p>
          </div>
        </section>
      )}

      <div className="category-row flex flex-wrap gap-3 my-[22px]">
        <button
          className={`rounded-full px-4 py-[10px] text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 ${
            activeTab === 'posts'
              ? 'bg-blue-soft text-blue border border-blue'
              : 'bg-white text-text-2 border border-line hover:border-[#b0c4de] hover:text-blue'
          }`}
          onClick={() => handleTabChange('posts')}
        >
          帖子
        </button>
        <button
          className={`rounded-full px-4 py-[10px] text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 ${
            activeTab === 'comments'
              ? 'bg-blue-soft text-blue border border-blue'
              : 'bg-white text-text-2 border border-line hover:border-[#b0c4de] hover:text-blue'
          }`}
          onClick={() => handleTabChange('comments')}
        >
          评论
        </button>
      </div>

      {searching && (
        <p className="result-hint mb-[14px] text-text-2 text-sm">
          搜索 &quot;{query}&quot; 找到 {resultCount} 条相关{activeTab === 'posts' ? '点赞帖子' : '点赞评论'}。
        </p>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-3">加载中...</div>
      ) : error ? (
        <EmptyState title="加载失败" description={error} />
      ) : activeTab === 'posts' ? (
        filteredPosts.length === 0 ? (
          <EmptyState title={searching ? '没有找到匹配的点赞帖子' : '还没有赞过的帖子'} />
        ) : (
          <>
            <section className="masonry-grid [column-count:2] [column-gap:18px] max-sm:[column-count:1] max-sm:[column-gap:12px]">
              {visiblePosts.map((post) => {
                return (
                  <div key={post.id} className="inline-block w-full mb-[18px]">
                    <PostCard
                      compact
                      post={post}
                      onOpen={async () => {
                        await flushAllPendingUnlikes();
                        onOpenPost(post);
                      }}
                      previewMode
                      liked={post.isLiked}
                      onLike={() => handlePostUnlike(post.id)}
                      onReport={onReport}
                    />
                  </div>
                );
              })}
            </section>
            {visiblePosts.length < filteredPosts.length && (
              <div className="pt-2">
                <button
                  type="button"
                  className="secondary-button w-full"
                  onClick={() => setVisiblePostCount((count) => count + LIKES_PAGE_BATCH_SIZE)}
                >
                  加载更多
                </button>
              </div>
            )}
          </>
        )
      ) : (
        filteredComments.length === 0 ? (
          <EmptyState title={searching ? '没有找到匹配的点赞评论' : '还没有赞过的评论'} />
        ) : (
          <>
            <section className="space-y-4">
              {visibleComments.map((comment, i) => {
                const postId = comment.postId;
                const post = postId ? allPosts.find((p) => p.id === postId) : null;
                const isLiked = comment.item?.isLiked ?? false;
                const postIsDeleted = comment.postIsDeleted || post?.isDeleted || false;

                return (
                  <div
                    key={comment.item?.id || `${comment.postId}-${comment.type}-${i}`}
                    className="comment-card p-4 border border-line rounded-xl bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-xs font-medium cursor-pointer hover:text-blue ${postIsDeleted ? 'text-text-3 line-through' : 'text-text-3'}`}
                        onClick={() => handleOpenCommentPost(comment)}
                      >
                        来自：{postIsDeleted ? '[已删除]' : (post?.title || comment.postTitle || '无标题')}
                      </span>
                    </div>
                    <ExpandableText
                      className="mb-2 text-sm text-text-2"
                      content={`${comment.type === 'reply' ? '↳ ' : '💬 '}${comment.item?.content || ''}`}
                      collapsedLinesClass={comment.type === 'reply' ? 'line-clamp-5' : 'line-clamp-8'}
                      charThreshold={comment.type === 'reply' ? 140 : 220}
                      lineThreshold={comment.type === 'reply' ? 5 : 8}
                    />
                    <div className="flex items-center gap-3 text-xs text-text-3">
                      <button
                        type="button"
                        onClick={() => handleCommentUnlike(comment)}
                        className={`inline-flex items-center gap-1 transition-colors duration-150 ${isLiked ? 'text-red' : 'hover:text-red'}`}
                      >
                        <Icon name={isLiked ? 'favorite' : 'favorite_border'} />
                        {comment.item?.likes || 0}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
            {visibleComments.length < filteredComments.length && (
              <div className="pt-2">
                <button
                  type="button"
                  className="secondary-button w-full"
                  onClick={() => setVisibleCommentCount((count) => count + LIKES_PAGE_BATCH_SIZE)}
                >
                  加载更多
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

export default LikesPage;
