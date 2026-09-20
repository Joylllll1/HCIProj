import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import AppError from '../utils/AppError.js';
import { notifyComment } from './notificationService.js';
import { syncPostCommentCount } from './commentCountService.js';
import { normalizeInlineImage } from '../utils/image.js';
import { broadcast } from './sseManager.js';

function broadcastPostCommentStats(postId, comments) {
  try {
    broadcast('post-stats-updated', {
      postId: postId.toString(),
      comments: Math.max(0, comments || 0),
    });
  } catch (error) {
    console.error('SSE broadcast failed after comment stats update:', error);
  }
}

export const createComment = async (userId, postId, content, image = '', official = false) => {
  const post = await Post.findById(postId);
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedImage = normalizeInlineImage(image, '评论图片');

  if (!normalizedContent && !normalizedImage) {
    throw new AppError('请输入内容或上传图片', 400, 'COMMENT_CONTENT_REQUIRED');
  }

  const comment = await Comment.create({
    postId,
    ownerUserId: userId,
    content: normalizedContent,
    image: normalizedImage,
    official,
  });

  const visibleCommentCount = await syncPostCommentCount(postId);

  // 触发评论通知（不等待完成）
  if (post.ownerUserId.toString() !== userId) {
    notifyComment(
      post.ownerUserId,
      '匿名用户', // 评论者名字，实际应该通过匿名ID系统获取
      post.title,
      postId
    ).catch(() => {});
  }

  const commentDto = {
    ...comment.toObject(),
    id: comment._id.toString(),
    time: formatRelativeTime(comment.createdAt),
  };

  try {
    broadcastPostCommentStats(postId, visibleCommentCount);
    broadcast('comment-created', {
      postId: postId.toString(),
      comment: commentDto,
    });
  } catch (error) {
    console.error('SSE broadcast failed after comment creation:', error);
  }

  return commentDto;
};

export const addReply = async (userId, commentId, content, image = '', official = false, replyToId = null) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedImage = normalizeInlineImage(image, '回复图片');

  if (!normalizedContent && !normalizedImage) {
    throw new AppError('请输入内容或上传图片', 400, 'REPLY_CONTENT_REQUIRED');
  }

  // 如果 replyToId 存在，验证被回复的回复是否存在
  if (replyToId) {
    const parentReply = comment.replies.id(replyToId);
    if (!parentReply || parentReply.isDeleted) throw new AppError('被回复的回复不存在', 404, 'REPLY_NOT_FOUND');
  }

  const reply = {
    ownerUserId: userId,
    content: normalizedContent,
    image: normalizedImage,
    official,
    likes: 0,
    likedBy: [],
    replyToId,
  };
  comment.replies.push(reply);
  await comment.save();

  const visibleCommentCount = await syncPostCommentCount(comment.postId);

  const savedReply = comment.replies[comment.replies.length - 1];
  const replyDto = {
    id: savedReply._id.toString(),
    ownerUserId: savedReply.ownerUserId.toString(),
    content: savedReply.content,
    image: savedReply.image || '',
    official: savedReply.official,
    likes: savedReply.likes || 0,
    likedBy: [],
    replyToId: savedReply.replyToId ? savedReply.replyToId.toString() : null,
    createdAt: savedReply.createdAt,
    time: formatRelativeTime(savedReply.createdAt),
    isLiked: false,
  };

  try {
    broadcastPostCommentStats(comment.postId, visibleCommentCount);
    broadcast('reply-created', {
      postId: comment.postId.toString(),
      commentId: comment._id.toString(),
      reply: replyDto,
    });
  } catch (error) {
    console.error('SSE broadcast failed after reply creation:', error);
  }

  return replyDto;
};

export const getComments = async (postId, userId) => {
  const comments = await Comment.find({ postId, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  return comments.map((c) => ({
    ...c,
    id: c._id.toString(),
    time: formatRelativeTime(c.createdAt),
    replies: (c.replies || [])
      .filter((r) => !r.isDeleted)
      .map((r) => ({
        ...r,
        id: r._id.toString(),
        ownerUserId: typeof r.ownerUserId === 'object' ? r.ownerUserId.toString() : r.ownerUserId,
        replyToId: r.replyToId ? (typeof r.replyToId === 'object' ? r.replyToId.toString() : r.replyToId) : null,
        time: formatRelativeTime(r.createdAt),
        isLiked: userId ? r.likedBy?.some((id) => id.toString() === userId) : false,
      })),
    isLiked: userId ? c.likedBy?.some((id) => id.toString() === userId) : false,
  }));
};

export const deleteComment = async (userId, commentId) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
  if (comment.ownerUserId.toString() !== userId) {
    throw new AppError('无权删除此评论', 403, 'FORBIDDEN');
  }

  const deletedReplyCount = (comment.replies || []).filter((reply) => !reply.isDeleted).length;
  comment.isDeleted = true;
  await comment.save();

  const visibleCommentCount = await syncPostCommentCount(comment.postId);

  const result = {
    postId: comment.postId.toString(),
    commentId: comment._id.toString(),
    deletedReplyCount,
  };

  try {
    broadcastPostCommentStats(comment.postId, visibleCommentCount);
    broadcast('comment-deleted', result);
  } catch (error) {
    console.error('SSE broadcast failed after comment deletion:', error);
  }

  return result;
};

export const deleteReply = async (userId, commentId, replyId) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');

  const reply = comment.replies.id(replyId);
  if (!reply || reply.isDeleted) throw new AppError('回复不存在', 404, 'REPLY_NOT_FOUND');
  if (reply.ownerUserId.toString() !== userId) {
    throw new AppError('无权删除此回复', 403, 'FORBIDDEN');
  }

  reply.isDeleted = true;
  await comment.save();

  const visibleCommentCount = await syncPostCommentCount(comment.postId);

  const result = {
    postId: comment.postId.toString(),
    commentId: comment._id.toString(),
    replyId: reply._id.toString(),
  };

  try {
    broadcastPostCommentStats(comment.postId, visibleCommentCount);
    broadcast('reply-deleted', result);
  } catch (error) {
    console.error('SSE broadcast failed after reply deletion:', error);
  }

  return result;
};

export const toggleLike = async (userId, commentId) => {
  const unlikedComment = await Comment.findOneAndUpdate(
    { _id: commentId, isDeleted: false, likedBy: userId },
    { $pull: { likedBy: userId }, $inc: { likes: -1 } },
    { new: true }
  ).lean();

  if (unlikedComment) {
    return { liked: false, likes: Math.max(0, unlikedComment.likes || 0) };
  }

  const likedComment = await Comment.findOneAndUpdate(
    { _id: commentId, isDeleted: false, likedBy: { $ne: userId } },
    { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
    { new: true }
  ).lean();

  if (likedComment) {
    return { liked: true, likes: likedComment.likes || 0 };
  }

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false }).lean();
  if (!comment) throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');

  return {
    liked: comment.likedBy?.some((id) => id.toString() === userId) || false,
    likes: comment.likes || 0,
  };
};

export const toggleReplyLike = async (userId, commentId, replyId) => {
  const unlikedComment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      isDeleted: false,
      replies: {
        $elemMatch: {
          _id: replyId,
          isDeleted: { $ne: true },
          likedBy: userId,
        },
      },
    },
    {
      $pull: { 'replies.$.likedBy': userId },
      $inc: { 'replies.$.likes': -1 },
    },
    { new: true }
  ).lean();

  if (unlikedComment) {
    const reply = unlikedComment.replies?.find((item) => item._id.toString() === replyId.toString());
    return { liked: false, likes: Math.max(0, reply?.likes || 0) };
  }

  const likedComment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      isDeleted: false,
      replies: {
        $elemMatch: {
          _id: replyId,
          isDeleted: { $ne: true },
          likedBy: { $ne: userId },
        },
      },
    },
    {
      $addToSet: { 'replies.$.likedBy': userId },
      $inc: { 'replies.$.likes': 1 },
    },
    { new: true }
  ).lean();

  if (likedComment) {
    const reply = likedComment.replies?.find((item) => item._id.toString() === replyId.toString());
    return { liked: true, likes: reply?.likes || 0 };
  }

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false }).lean();
  if (!comment) throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');

  const reply = comment.replies?.find((item) => item._id.toString() === replyId.toString());
  if (!reply || reply.isDeleted) throw new AppError('回复不存在', 404, 'REPLY_NOT_FOUND');

  return {
    liked: reply.likedBy?.some((id) => id.toString() === userId) || false,
    likes: reply.likes || 0,
  };
};

// ─── Helpers ───

function formatRelativeTime(date) {
  if (!date) return '';
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}
