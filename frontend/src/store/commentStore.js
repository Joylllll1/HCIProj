import { create } from 'zustand';
import * as commentService from '../services/commentService';
import usePostStore from './postStore';

let accountGeneration = 0;

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

function captureLikeFields(item) {
  return {
    hasIsLiked: Object.prototype.hasOwnProperty.call(item, 'isLiked'),
    isLiked: item.isLiked,
    hasLikes: Object.prototype.hasOwnProperty.call(item, 'likes'),
    likes: item.likes,
  };
}

function restoreLikeFields(item, previous, optimistic) {
  let next = item;
  if (
    Object.prototype.hasOwnProperty.call(item, 'isLiked')
    && Object.is(item.isLiked, optimistic.isLiked)
  ) {
    next = { ...next };
    if (previous.hasIsLiked) next.isLiked = previous.isLiked;
    else delete next.isLiked;
  }
  if (
    Object.prototype.hasOwnProperty.call(item, 'likes')
    && Object.is(item.likes, optimistic.likes)
  ) {
    if (next === item) next = { ...next };
    if (previous.hasLikes) next.likes = previous.likes;
    else delete next.likes;
  }
  return next;
}

function captureCommentLikeTargets(commentsMap, commentId) {
  const targets = [];
  for (const [postId, comments] of Object.entries(commentsMap)) {
    for (const comment of comments) {
      if (getCommentId(comment) !== commentId) continue;
      targets.push({
        postId,
        commentId,
        previous: captureLikeFields(comment),
        optimistic: {
          isLiked: !comment.isLiked,
          likes: comment.isLiked ? Math.max(0, comment.likes - 1) : comment.likes + 1,
        },
      });
    }
  }
  return targets;
}

function rollbackCommentLikeTargets(commentsMap, targets) {
  const targetsByPost = new Map(targets.map((target) => [target.postId, target]));
  let nextCommentsMap = commentsMap;
  for (const [postId, target] of targetsByPost) {
    const comments = commentsMap[postId] || [];
    let changed = false;
    const nextComments = comments.map((comment) => {
      if (getCommentId(comment) !== target.commentId) return comment;
      const restored = restoreLikeFields(comment, target.previous, target.optimistic);
      changed ||= restored !== comment;
      return restored;
    });
    if (changed) {
      if (nextCommentsMap === commentsMap) nextCommentsMap = { ...commentsMap };
      nextCommentsMap[postId] = nextComments;
    }
  }
  return nextCommentsMap;
}

function captureReplyLikeTargets(commentsMap, commentId, replyId) {
  const targets = [];
  for (const [postId, comments] of Object.entries(commentsMap)) {
    for (const comment of comments) {
      if (getCommentId(comment) !== commentId) continue;
      for (const reply of comment.replies || []) {
        if (getCommentId(reply) !== replyId) continue;
        targets.push({
          postId,
          commentId,
          replyId,
          previous: captureLikeFields(reply),
          optimistic: {
            isLiked: !reply.isLiked,
            likes: reply.isLiked ? Math.max(0, (reply.likes || 0) - 1) : (reply.likes || 0) + 1,
          },
        });
      }
    }
  }
  return targets;
}

function rollbackReplyLikeTargets(commentsMap, targets) {
  const targetsByPost = new Map(targets.map((target) => [target.postId, target]));
  let nextCommentsMap = commentsMap;
  for (const [postId, target] of targetsByPost) {
    const comments = commentsMap[postId] || [];
    let changed = false;
    const nextComments = comments.map((comment) => {
      if (getCommentId(comment) !== target.commentId) return comment;
      let replyChanged = false;
      const replies = (comment.replies || []).map((reply) => {
        if (getCommentId(reply) !== target.replyId) return reply;
        const restored = restoreLikeFields(reply, target.previous, target.optimistic);
        replyChanged ||= restored !== reply;
        return restored;
      });
      if (!replyChanged) return comment;
      changed = true;
      return { ...comment, replies };
    });
    if (changed) {
      if (nextCommentsMap === commentsMap) nextCommentsMap = { ...commentsMap };
      nextCommentsMap[postId] = nextComments;
    }
  }
  return nextCommentsMap;
}

function getCommentId(comment) {
  return comment?.id || comment?._id;
}

function hasComment(commentsMap, postId, commentId) {
  return (commentsMap[postId] || []).some((comment) => getCommentId(comment) === commentId);
}

function hasReply(commentsMap, postId, commentId, replyId) {
  const comment = (commentsMap[postId] || []).find(
    (item) => getCommentId(item) === commentId,
  );
  return (comment?.replies || []).some((reply) => getCommentId(reply) === replyId);
}

function countVisibleComments(comments) {
  return comments.reduce((count, comment) => count + 1 + (comment.replies || []).length, 0);
}

function replayCommentFetchMutation(comments, mutation) {
  if (mutation.type === 'upsertComment') {
    const incomingId = getCommentId(mutation.comment);
    const existing = comments.some((comment) => getCommentId(comment) === incomingId);
    return existing
      ? comments.map((comment) => (
        getCommentId(comment) === incomingId ? { ...comment, ...mutation.comment } : comment
      ))
      : [...comments, mutation.comment];
  }

  if (mutation.type === 'removeComment') {
    return comments.filter((comment) => getCommentId(comment) !== mutation.commentId);
  }

  if (mutation.type === 'upsertReply') {
    return comments.map((comment) => {
      if (getCommentId(comment) !== mutation.commentId) return comment;
      const replies = comment.replies || [];
      const incomingId = getCommentId(mutation.reply);
      const exists = replies.some((reply) => getCommentId(reply) === incomingId);
      return {
        ...comment,
        replies: exists
          ? replies.map((reply) => (
            getCommentId(reply) === incomingId ? { ...reply, ...mutation.reply } : reply
          ))
          : [...replies, mutation.reply],
      };
    });
  }

  if (mutation.type === 'removeReply') {
    return comments.map((comment) => (
      getCommentId(comment) === mutation.commentId
        ? {
          ...comment,
          replies: (comment.replies || []).filter(
            (reply) => getCommentId(reply) !== mutation.replyId,
          ),
        }
        : comment
    ));
  }

  return comments;
}

function mergeFetchedReplyWithLocalChanges(startingReply, currentReply, fetchedReply) {
  const merged = { ...fetchedReply };
  const keys = new Set([
    ...Object.keys(startingReply || {}),
    ...Object.keys(currentReply || {}),
  ]);

  for (const key of keys) {
    if (Object.is(startingReply?.[key], currentReply?.[key])) continue;
    if (Object.prototype.hasOwnProperty.call(currentReply, key)) {
      merged[key] = currentReply[key];
    } else {
      delete merged[key];
    }
  }

  return merged;
}

function mergeFetchedRepliesWithLocalChanges(startingReplies, currentReplies, fetchedReplies) {
  const startingById = new Map(startingReplies.map((reply) => [getCommentId(reply), reply]));
  const currentById = new Map(currentReplies.map((reply) => [getCommentId(reply), reply]));
  const fetchedIds = new Set(fetchedReplies.map(getCommentId));
  const merged = [];

  for (const reply of fetchedReplies) {
    const replyId = getCommentId(reply);
    const existedAtStart = startingById.has(replyId);
    const current = currentById.get(replyId);
    if (existedAtStart && !current) continue;
    merged.push(
      existedAtStart && current && current !== startingById.get(replyId)
        ? mergeFetchedReplyWithLocalChanges(startingById.get(replyId), current, reply)
        : reply,
    );
  }

  for (const reply of currentReplies) {
    const replyId = getCommentId(reply);
    const changedAfterStart = !startingById.has(replyId)
      || startingById.get(replyId) !== reply;
    if (changedAfterStart && !fetchedIds.has(replyId)) merged.push(reply);
  }

  return merged;
}

function mergeFetchedCommentWithLocalChanges(startingComment, currentComment, fetchedComment) {
  const merged = { ...fetchedComment };
  const keys = new Set([
    ...Object.keys(startingComment || {}),
    ...Object.keys(currentComment || {}),
  ]);

  for (const key of keys) {
    if (key === 'replies' || Object.is(startingComment?.[key], currentComment?.[key])) continue;
    if (Object.prototype.hasOwnProperty.call(currentComment, key)) {
      merged[key] = currentComment[key];
    } else {
      delete merged[key];
    }
  }

  merged.replies = mergeFetchedRepliesWithLocalChanges(
    startingComment?.replies || [],
    currentComment?.replies || [],
    fetchedComment.replies || [],
  );
  return merged;
}

function mergeFetchedCommentsWithLocalChanges(
  startingComments,
  currentComments,
  fetchedComments,
  fetchMutations,
) {
  const startingById = new Map(startingComments.map((comment) => [getCommentId(comment), comment]));
  const currentById = new Map(currentComments.map((comment) => [getCommentId(comment), comment]));
  const fetchedIds = new Set(fetchedComments.map(getCommentId));
  const merged = [];

  for (const comment of fetchedComments) {
    const commentId = getCommentId(comment);
    const existedAtStart = startingById.has(commentId);
    const current = currentById.get(commentId);

    // A missing comment was removed locally while this request was in flight.
    if (existedAtStart && !current) continue;

    // Keep an item changed locally after the request began, while using the
    // response as the source of truth for untouched items.
    merged.push(
      existedAtStart && current && current !== startingById.get(commentId)
        ? mergeFetchedCommentWithLocalChanges(startingById.get(commentId), current, comment)
        : comment,
    );
  }

  for (const comment of currentComments) {
    const commentId = getCommentId(comment);
    const changedAfterStart = !startingById.has(commentId)
      || startingById.get(commentId) !== comment;
    if (changedAfterStart && !fetchedIds.has(commentId)) {
      merged.push(comment);
    }
  }

  return fetchMutations.reduce(replayCommentFetchMutation, merged);
}

function appendFetchMutation(state, postId, mutation) {
  const current = state.fetchMutationsByPost[postId];
  if (!current) return state.fetchMutationsByPost;
  return {
    ...state.fetchMutationsByPost,
    [postId]: [...current, mutation],
  };
}

function clearFetchMutations(fetchMutationsByPost, postId) {
  const next = { ...fetchMutationsByPost };
  delete next[postId];
  return next;
}

const useCommentStore = create((set, get) => ({
  commentsMap: {},
  loadStates: {},
  loadedPostIds: {},
  fetchMutationsByPost: {},
  pendingCommentUnlikes: [],
  submittingCommentUnlikes: [],

  resetForAccountChange: () => {
    accountGeneration += 1;
    set({
      commentsMap: {},
      loadStates: {},
      loadedPostIds: {},
      fetchMutationsByPost: {},
      pendingCommentUnlikes: [],
      submittingCommentUnlikes: [],
    });
  },

  fetchComments: async (postId) => {
    if (get().loadStates[postId]?.loading) return;
    const requestGeneration = accountGeneration;
    const startingComments = get().commentsMap[postId] || [];
    set((s) => ({
      loadStates: { ...s.loadStates, [postId]: { loading: true, error: '' } },
      fetchMutationsByPost: { ...s.fetchMutationsByPost, [postId]: [] },
    }));
    try {
      const comments = await commentService.getComments(postId);
      if (requestGeneration !== accountGeneration) return null;
      let mergedComments;
      set((state) => {
        const currentComments = state.commentsMap[postId] || [];
        mergedComments = mergeFetchedCommentsWithLocalChanges(
          startingComments,
          currentComments,
          comments,
          state.fetchMutationsByPost[postId] || [],
        );
        return {
          commentsMap: {
            ...state.commentsMap,
            [postId]: mergedComments,
          },
          loadStates: { ...state.loadStates, [postId]: { loading: false, error: '' } },
          loadedPostIds: { ...state.loadedPostIds, [postId]: true },
          fetchMutationsByPost: clearFetchMutations(state.fetchMutationsByPost, postId),
        };
      });
      usePostStore.getState().applyRealtimePostStats(postId, {
        comments: countVisibleComments(mergedComments),
      });
      return comments;
    } catch (err) {
      if (requestGeneration !== accountGeneration) return null;
      set((s) => ({
        loadStates: {
          ...s.loadStates,
          [postId]: { loading: false, error: err.message || '评论加载失败，请重试。' },
        },
        fetchMutationsByPost: clearFetchMutations(s.fetchMutationsByPost, postId),
      }));
      return null;
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
        fetchMutationsByPost: appendFetchMutation(state, postId, {
          type: 'upsertComment',
          comment: incomingComment,
        }),
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
      fetchMutationsByPost: appendFetchMutation(state, postId, {
        type: 'removeComment',
        commentId,
      }),
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
      fetchMutationsByPost: appendFetchMutation(state, postId, {
        type: 'upsertReply',
        commentId,
        reply: incomingReply,
      }),
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
      fetchMutationsByPost: appendFetchMutation(state, postId, {
        type: 'removeReply',
        commentId,
        replyId,
      }),
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
    set((state) => {
      const isSubmitting = state.submittingCommentUnlikes.some(
        (submittingItem) => getPendingUnlikeKey(submittingItem.type, submittingItem.id) === itemKey,
      );
      if (isSubmitting) return state;

      return {
        pendingCommentUnlikes: state.pendingCommentUnlikes.some(
          (pendingItem) => getPendingUnlikeKey(pendingItem.type, pendingItem.id) === itemKey,
        )
          ? state.pendingCommentUnlikes.filter(
              (pendingItem) => getPendingUnlikeKey(pendingItem.type, pendingItem.id) !== itemKey,
            )
          : [...state.pendingCommentUnlikes, item],
      };
    });
  },

  submitPendingCommentUnlikes: async (items) => {
    const requestGeneration = accountGeneration;
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
      if (requestGeneration !== accountGeneration) break;
      try {
        const result = item.type === 'reply'
          ? await commentService.toggleReplyLike(item.parentId, item.id)
          : await commentService.toggleLike(item.id);
        if (requestGeneration !== accountGeneration) break;
        succeeded.push({ item, result });
      } catch (error) {
        if (requestGeneration !== accountGeneration) break;
        failed.push({ item, error });
      }
    }

    if (requestGeneration !== accountGeneration) {
      return { succeeded: [], failed: [] };
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
    const requestGeneration = accountGeneration;
    const comment = await commentService.createComment(postId, content, image, official);
    if (requestGeneration !== accountGeneration) return comment;
    const alreadyPresent = hasComment(get().commentsMap, postId, getCommentId(comment));
    get().upsertComment(postId, comment);
    if (!alreadyPresent) {
      usePostStore.getState().updateCommentCount(postId, 1);
    }
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

    const requestGeneration = accountGeneration;
    const likeTargets = captureCommentLikeTargets(get().commentsMap, commentId);
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
      if (requestGeneration === accountGeneration) {
        set((state) => ({
          commentsMap: rollbackCommentLikeTargets(state.commentsMap, likeTargets),
        }));
      }
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

    const requestGeneration = accountGeneration;
    const likeTargets = captureReplyLikeTargets(get().commentsMap, commentId, replyId);
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
      if (requestGeneration === accountGeneration) {
        set((state) => ({
          commentsMap: rollbackReplyLikeTargets(state.commentsMap, likeTargets),
        }));
      }
    }
  },

  addReply: async (commentId, content, image = '', official = false, replyToId = null) => {
    const requestGeneration = accountGeneration;
    const reply = await commentService.addReply(commentId, content, image, official, replyToId);
    if (requestGeneration !== accountGeneration) return reply;
    const matchingPostIds = Object.keys(get().commentsMap).filter((postId) =>
      (get().commentsMap[postId] || []).some((comment) => (comment.id || comment._id) === commentId),
    );
    for (const postId of matchingPostIds) {
      const alreadyPresent = hasReply(get().commentsMap, postId, commentId, getCommentId(reply));
      get().upsertReply(postId, commentId, reply);
      if (!alreadyPresent) {
        usePostStore.getState().updateCommentCount(postId, 1);
      }
    }
    return reply;
  },

  deleteComment: async (commentId) => {
    const requestGeneration = accountGeneration;
    const result = await commentService.deleteComment(commentId);
    if (requestGeneration !== accountGeneration) return result;
    const wasPresent = hasComment(get().commentsMap, result.postId, result.commentId);
    if (wasPresent) {
      usePostStore.getState().updateCommentCount(
        result.postId,
        -(1 + Math.max(0, Number(result.deletedReplyCount || 0))),
      );
    }
    get().removeComment(result.postId, result.commentId);
    return result;
  },

  deleteReply: async (commentId, replyId) => {
    const requestGeneration = accountGeneration;
    const result = await commentService.deleteReply(commentId, replyId);
    if (requestGeneration !== accountGeneration) return result;
    const wasPresent = hasReply(
      get().commentsMap,
      result.postId,
      result.commentId,
      result.replyId,
    );
    if (wasPresent) {
      usePostStore.getState().updateCommentCount(result.postId, -1);
    }
    get().removeReply(result.postId, result.commentId, result.replyId);
    return result;
  },

  getCommentsByPostId: (postId) => {
    return get().commentsMap[postId] || [];
  },
}));

export default useCommentStore;
