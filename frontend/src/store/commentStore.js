import { create } from 'zustand';
import * as commentService from '../services/commentService';
import usePostStore from './postStore';

function getPendingUnlikeKey(type, id) {
  return `${type}-${id}`;
}

function applyCommentLikeState(commentsMap, commentId, patch) {
  const updated = { ...commentsMap };
  for (const postId of Object.keys(updated)) {
    updated[postId] = updated[postId].map((comment) =>
      comment.id === commentId || comment._id === commentId
        ? { ...comment, ...patch }
        : comment,
    );
  }
  return updated;
}

function applyReplyLikeState(commentsMap, commentId, replyId, patch) {
  const updated = { ...commentsMap };
  for (const postId of Object.keys(updated)) {
    updated[postId] = updated[postId].map((comment) => {
      if (comment.id !== commentId && comment._id !== commentId) {
        return comment;
      }
      return {
        ...comment,
        replies: (comment.replies || []).map((reply) =>
          reply.id === replyId || reply._id === replyId
            ? { ...reply, ...patch }
            : reply,
        ),
      };
    });
  }
  return updated;
}

const useCommentStore = create((set, get) => ({
  commentsMap: {},
  loadedPostIds: {},
  pendingCommentUnlikes: [],
  submittingCommentUnlikes: [],

  fetchComments: async (postId) => {
    try {
      const comments = await commentService.getComments(postId);
      set((state) => ({
        commentsMap: { ...state.commentsMap, [postId]: comments },
        loadedPostIds: { ...state.loadedPostIds, [postId]: true },
      }));
    } catch {
      // Silently fail — UI handles empty state
    }
  },

  upsertComment: (postId, incomingComment) => {
    set((state) => {
      const existing = state.commentsMap[postId] || [];
      const incomingId = incomingComment.id || incomingComment._id;
      const alreadyExists = existing.some((comment) => (comment.id || comment._id) === incomingId);
      return {
        commentsMap: {
          ...state.commentsMap,
          [postId]: alreadyExists
            ? existing.map((comment) =>
                (comment.id || comment._id) === incomingId ? { ...comment, ...incomingComment } : comment,
              )
            : [...existing, incomingComment],
        },
        loadedPostIds: { ...state.loadedPostIds, [postId]: true },
      };
    });
  },

  removeComment: (postId, commentId) => {
    set((state) => ({
      commentsMap: {
        ...state.commentsMap,
        [postId]: (state.commentsMap[postId] || []).filter(
          (comment) => (comment.id || comment._id) !== commentId,
        ),
      },
    }));
  },

  upsertReply: (postId, commentId, incomingReply) => {
    set((state) => ({
      commentsMap: {
        ...state.commentsMap,
        [postId]: (state.commentsMap[postId] || []).map((comment) => {
          if ((comment.id || comment._id) !== commentId) {
            return comment;
          }

          const replies = comment.replies || [];
          const incomingId = incomingReply.id || incomingReply._id;
          const alreadyExists = replies.some((reply) => (reply.id || reply._id) === incomingId);

          return {
            ...comment,
            replies: alreadyExists
              ? replies.map((reply) =>
                  (reply.id || reply._id) === incomingId ? { ...reply, ...incomingReply } : reply,
                )
              : [...replies, incomingReply],
          };
        }),
      },
      loadedPostIds: { ...state.loadedPostIds, [postId]: true },
    }));
  },

  removeReply: (postId, commentId, replyId) => {
    set((state) => ({
      commentsMap: {
        ...state.commentsMap,
        [postId]: (state.commentsMap[postId] || []).map((comment) =>
          (comment.id || comment._id) === commentId
            ? {
                ...comment,
                replies: (comment.replies || []).filter((reply) => (reply.id || reply._id) !== replyId),
              }
            : comment,
        ),
      },
    }));
  },

  // 获取扁平化的评论列表（评论和回复平级）
  getFlatComments: (postId) => {
    const comments = get().commentsMap[postId] || [];
    const pendingKeys = new Set(
      [...get().pendingCommentUnlikes, ...get().submittingCommentUnlikes].map((item) =>
        getPendingUnlikeKey(item.type, item.id),
      ),
    );
    const flatList = [];

    comments.forEach((comment) => {
      const commentPendingKey = getPendingUnlikeKey('comment', comment.id || comment._id);
      const isCommentPendingUnlike = pendingKeys.has(commentPendingKey);

      // 添加评论
      flatList.push({
        ...comment,
        itemType: 'comment',
        isLiked: isCommentPendingUnlike ? false : comment.isLiked,
        likes: isCommentPendingUnlike ? Math.max(0, (comment.likes || 0) - 1) : (comment.likes || 0),
      });
      // 添加评论下的所有回复
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach((reply) => {
          const replyPendingKey = getPendingUnlikeKey('reply', reply.id || reply._id);
          const isReplyPendingUnlike = pendingKeys.has(replyPendingKey);
          // 查找被回复的内容（可能是评论或另一个回复）
          let parentContent = comment.content;
          let parentAuthorId = comment.ownerUserId;
          let parentOfficial = comment.official;
          let parentTime = comment.createdAt;

          // 如果是回复另一个回复，需要找到那条回复
          if (reply.replyToId) {
            const parentReply = comment.replies.find(
              (r) => r.id === reply.replyToId || r._id === reply.replyToId
            );
            if (parentReply) {
              parentContent = parentReply.content;
              parentAuthorId = parentReply.ownerUserId;
              parentOfficial = parentReply.official;
              parentTime = parentReply.createdAt;
            }
          }

          flatList.push({
            ...reply,
            itemType: 'reply',
            isLiked: isReplyPendingUnlike ? false : reply.isLiked,
            likes: isReplyPendingUnlike ? Math.max(0, (reply.likes || 0) - 1) : (reply.likes || 0),
            parentId: comment.id || comment._id,
            parentContent,
            parentAuthorId,
            parentOfficial,
            parentTime,
          });
        });
      }
    });

    return flatList;
  },

  isPendingUnlike: (type, id) => {
    const key = getPendingUnlikeKey(type, id);
    return [...get().pendingCommentUnlikes, ...get().submittingCommentUnlikes]
      .some((item) => getPendingUnlikeKey(item.type, item.id) === key);
  },

  togglePendingUnlike: (item) => {
    const itemKey = getPendingUnlikeKey(item.type, item.id);
    set((state) => ({
      pendingCommentUnlikes: state.pendingCommentUnlikes.some(
        (pendingItem) => getPendingUnlikeKey(pendingItem.type, pendingItem.id) === itemKey,
      )
        ? state.pendingCommentUnlikes.filter(
            (pendingItem) => getPendingUnlikeKey(pendingItem.type, pendingItem.id) !== itemKey,
          )
        : [...state.pendingCommentUnlikes, item],
    }));
  },

  submitPendingCommentUnlikes: async (items) => {
    const currentPending = get().pendingCommentUnlikes;
    const targetItems = (items || currentPending).filter((item) =>
      currentPending.some((pendingItem) => getPendingUnlikeKey(pendingItem.type, pendingItem.id) === getPendingUnlikeKey(item.type, item.id)),
    );
    const uniqueTargets = Array.from(
      new Map(targetItems.map((item) => [getPendingUnlikeKey(item.type, item.id), item])).values(),
    );

    if (uniqueTargets.length === 0) {
      return { succeeded: [], failed: [] };
    }

    const targetKeys = uniqueTargets.map((item) => getPendingUnlikeKey(item.type, item.id));

    set((state) => ({
      pendingCommentUnlikes: state.pendingCommentUnlikes.filter(
        (item) => !targetKeys.includes(getPendingUnlikeKey(item.type, item.id)),
      ),
      submittingCommentUnlikes: [
        ...state.submittingCommentUnlikes.filter(
          (item) => !targetKeys.includes(getPendingUnlikeKey(item.type, item.id)),
        ),
        ...uniqueTargets,
      ],
    }));

    const succeeded = [];
    const failed = [];

    for (const item of uniqueTargets) {
      try {
        const result = item.type === 'reply'
          ? await commentService.toggleReplyLike(item.parentId, item.id)
          : await commentService.toggleLike(item.id);
        succeeded.push({ item, result });
      } catch (error) {
        failed.push({ item, error });
      }
    }

    set((state) => {
      let nextCommentsMap = state.commentsMap;
      for (const { item, result } of succeeded) {
        if (item.type === 'reply') {
          nextCommentsMap = applyReplyLikeState(nextCommentsMap, item.parentId, item.id, {
            isLiked: result.liked,
            likes: result.likes,
          });
        } else {
          nextCommentsMap = applyCommentLikeState(nextCommentsMap, item.id, {
            isLiked: result.liked,
            likes: result.likes,
          });
        }
      }

      return {
        commentsMap: nextCommentsMap,
        submittingCommentUnlikes: state.submittingCommentUnlikes.filter(
          (item) => !targetKeys.includes(getPendingUnlikeKey(item.type, item.id)),
        ),
      };
    });

    return {
      succeeded: succeeded.map(({ item }) => getPendingUnlikeKey(item.type, item.id)),
      failed: failed.map(({ item }) => getPendingUnlikeKey(item.type, item.id)),
    };
  },

  addComment: async (postId, content, image = '', official = false) => {
    const comment = await commentService.createComment(postId, content, image, official);
    get().upsertComment(postId, comment);
    usePostStore.getState().updateCommentCount(postId, 1);
    return comment;
  },

  toggleLike: async (commentId) => {
    if (get().isPendingUnlike('comment', commentId)) {
      set((state) => ({
        pendingCommentUnlikes: state.pendingCommentUnlikes.filter(
          (item) => getPendingUnlikeKey(item.type, item.id) !== getPendingUnlikeKey('comment', commentId),
        ),
      }));
      return;
    }

    const previous = get().commentsMap;
    // Optimistic update: toggle isLiked immediately
    set((state) => {
      const updated = { ...state.commentsMap };
      for (const postId of Object.keys(updated)) {
        updated[postId] = updated[postId].map((c) =>
          c.id === commentId || c._id === commentId
            ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? Math.max(0, c.likes - 1) : c.likes + 1 }
            : c,
        );
      }
      return { commentsMap: updated };
    });
    // Then sync with the API
    try {
      await commentService.toggleLike(commentId);
    } catch {
      // Rollback on failure
      set({ commentsMap: previous });
    }
  },

  toggleReplyLike: async (commentId, replyId) => {
    if (get().isPendingUnlike('reply', replyId)) {
      set((state) => ({
        pendingCommentUnlikes: state.pendingCommentUnlikes.filter(
          (item) => getPendingUnlikeKey(item.type, item.id) !== getPendingUnlikeKey('reply', replyId),
        ),
      }));
      return;
    }

    const previous = get().commentsMap;
    // Optimistic update
    set((state) => {
      const updated = { ...state.commentsMap };
      for (const postId of Object.keys(updated)) {
        updated[postId] = updated[postId].map((c) => {
          if (c.id === commentId || c._id === commentId) {
            const updatedReplies = (c.replies || []).map((r) => {
              if (r.id === replyId || r._id === replyId) {
                return {
                  ...r,
                  isLiked: !r.isLiked,
                  likes: r.isLiked ? Math.max(0, (r.likes || 0) - 1) : (r.likes || 0) + 1,
                };
              }
              return r;
            });
            return { ...c, replies: updatedReplies };
          }
          return c;
        });
      }
      return { commentsMap: updated };
    });
    // Then sync with the API
    try {
      await commentService.toggleReplyLike(commentId, replyId);
    } catch {
      // Rollback on failure
      set({ commentsMap: previous });
    }
  },

  addReply: async (commentId, content, image = '', official = false, replyToId = null) => {
    const reply = await commentService.addReply(commentId, content, image, official, replyToId);
    const matchingPostIds = Object.keys(get().commentsMap).filter((postId) =>
      (get().commentsMap[postId] || []).some((comment) => (comment.id || comment._id) === commentId),
    );
    for (const postId of matchingPostIds) {
      get().upsertReply(postId, commentId, reply);
      usePostStore.getState().updateCommentCount(postId, 1);
    }
    return reply;
  },

  deleteComment: async (commentId) => {
    const result = await commentService.deleteComment(commentId);
    usePostStore.getState().updateCommentCount(
      result.postId,
      -(1 + Math.max(0, Number(result.deletedReplyCount || 0))),
    );
    get().removeComment(result.postId, result.commentId);
    return result;
  },

  deleteReply: async (commentId, replyId) => {
    const result = await commentService.deleteReply(commentId, replyId);
    usePostStore.getState().updateCommentCount(result.postId, -1);
    get().removeReply(result.postId, result.commentId, result.replyId);
    return result;
  },

  getCommentsByPostId: (postId) => {
    return get().commentsMap[postId] || [];
  },
}));

export default useCommentStore;
