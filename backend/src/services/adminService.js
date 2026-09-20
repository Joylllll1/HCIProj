import Report from '../models/Report.js';
import Ban from '../models/Ban.js';
import AuditLog from '../models/AuditLog.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { sendBanNotification, sendUnbanNotification } from './emailService.js';
import { notifyBanned, notifyUnbanned } from './notificationService.js';
import { syncPostCommentCount } from './commentCountService.js';
import { broadcast } from './sseManager.js';

async function resolveAssociatedPostId(targetId, targetType) {
  if (targetType === 'post') {
    return targetId;
  }

  if (targetType === 'comment') {
    const comment = await Comment.findOne({ _id: targetId, isDeleted: false }).select('postId').lean();
    return comment?.postId || null;
  }

  if (targetType === 'reply') {
    const parentComment = await Comment.findOne({
      isDeleted: false,
      replies: { $elemMatch: { _id: targetId, isDeleted: { $ne: true } } },
    }).select('postId').lean();
    return parentComment?.postId || null;
  }

  return null;
}

async function getReplyIdsByUser(userId) {
  const replies = await Comment.aggregate([
    { $unwind: '$replies' },
    { $match: { 'replies.ownerUserId': userId } },
    { $project: { _id: '$replies._id' } },
  ]);

  return replies.map((reply) => reply._id);
}

async function countReportsAgainstUserContent(userId) {
  const [postIds, commentIds, replyIds] = await Promise.all([
    Post.find({ ownerUserId: userId }).distinct('_id'),
    Comment.find({ ownerUserId: userId }).distinct('_id'),
    getReplyIdsByUser(userId),
  ]);

  const reportTargets = [];

  if (postIds.length > 0) {
    reportTargets.push({ targetType: 'post', targetId: { $in: postIds } });
    reportTargets.push({ targetType: { $exists: false }, postId: { $in: postIds } });
  }

  if (commentIds.length > 0) {
    reportTargets.push({ targetType: 'comment', targetId: { $in: commentIds } });
  }

  if (replyIds.length > 0) {
    reportTargets.push({ targetType: 'reply', targetId: { $in: replyIds } });
  }

  if (reportTargets.length === 0) {
    return 0;
  }

  const [summary] = await Report.aggregate([
    { $match: { $or: reportTargets } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ['$reportCount', 1] } },
      },
    },
  ]);

  return summary?.total || 0;
}

// ─── Reports ───

export async function getPendingReports() {
  // 获取待处理举报
  const reports = await Report.find({ status: 'pending' })
    .populate('postId', 'title content ownerUserId isDeleted mood moodType createdAt')
    .populate('reasons.reportedBy', 'email')
    .sort({ reportCount: -1, createdAt: -1 })
    .lean();

  // 丰富化举报数据
  const enrichedReports = await Promise.all(reports.map(async (report) => {
    // 处理旧数据：没有 targetType 的默认为 'post'
    const targetType = report.targetType || 'post';
    // 旧数据：没有 targetId 时，使用 postId 作为 targetId
    const targetId = report.targetId || report.postId?._id || report.postId;

    if (targetType === 'post') {
      // 旧数据：postId 为空时，targetId 就是帖子 ID
      let post = report.postId;
      if (!post && targetId) {
        post = await Post.findById(targetId)
          .select('title content ownerUserId isDeleted mood moodType createdAt')
          .lean();
      }
      return { ...report, targetType: 'post', targetId, postId: post };
    }

    // 评论/回复举报，获取评论/回复内容
    let target = null;
    if (targetType === 'reply') {
      // 回复是嵌入文档，需要找到包含该回复的评论
      const parentComment = await Comment.findOne({ 'replies._id': targetId }).lean();
      if (parentComment && !parentComment.isDeleted) {
        target = parentComment.replies.find(r => r._id.toString() === targetId.toString());
        // 将回复的 ownerUserId 等信息标准化
        if (target && !target.isDeleted) {
          target.postId = parentComment.postId; // 从父评论获取 postId
        }
      }
    } else {
      // 普通评论
      target = targetId ? await Comment.findById(targetId)
        .select('content ownerUserId createdAt postId isDeleted')
        .lean() : null;
      if (target?.isDeleted) {
        target = null;
      }
    }

    // 获取所属帖子信息
    let postInfo = report.postId;
    if (!postInfo && target?.postId) {
      postInfo = await Post.findById(target.postId).select('title').lean();
    }

    return {
      ...report,
      targetType,
      targetId,
      targetContent: target?.content || '[已删除]',
      targetOwnerUserId: target?.ownerUserId,
      targetCreatedAt: target?.createdAt,
      postId: postInfo,
    };
  }));

  return enrichedReports;
}

export async function createReport(targetId, targetType, reason, reportedBy) {
  // 快速路径：同一用户已举报过该目标
  const existingReportByUser = await Report.findOne({
    targetId,
    targetType,
    status: 'pending',
    'reasons.reportedBy': reportedBy,
  }).lean();

  if (existingReportByUser) {
    const error = new Error('您已经举报过该内容，请等待管理员处理');
    error.code = 'ALREADY_REPORTED';
    throw error;
  }

  // For comments/replies, find the associated post
  const postId = await resolveAssociatedPostId(targetId, targetType);

  const update = {
    $inc: { reportCount: 1 },
    $push: { reasons: { reason, reportedBy } },
    $setOnInsert: {
      targetType,
      targetId,
      postId,
      status: 'pending',
    },
  };

  try {
    const report = await Report.findOneAndUpdate(
      {
        targetId,
        targetType,
        status: 'pending',
        'reasons.reportedBy': { $ne: reportedBy },
      },
      update,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return report;
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
  }

  // 另一个并发请求已创建 pending 举报，重试聚合；若该用户已存在则视为重复举报
  const report = await Report.findOneAndUpdate(
    {
      targetId,
      targetType,
      status: 'pending',
      'reasons.reportedBy': { $ne: reportedBy },
    },
    {
      $inc: { reportCount: 1 },
      $push: { reasons: { reason, reportedBy } },
    },
    { new: true }
  );

  if (!report) {
    const error = new Error('您已经举报过该内容，请等待管理员处理');
    error.code = 'ALREADY_REPORTED';
    throw error;
  }

  return report;
}

export async function dismissReport(reportId) {
  const report = await Report.findByIdAndDelete(reportId);
  if (!report) {
    throw new AppError('举报不存在', 404, 'REPORT_NOT_FOUND');
  }
  return report;
}

// ─── Tracing ───

export async function tracePostAuthor(postId, adminId, reason) {
  if (!reason || !reason.trim()) {
    throw new AppError('请输入追溯原因', 400, 'MISSING_REASON');
  }

  const post = await Post.findById(postId).populate('ownerUserId', 'email');
  if (!post) {
    throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  }

  // Get user activity stats
  const userId = post.ownerUserId._id;
  const [postCount, commentCount, reportCount] = await Promise.all([
    Post.countDocuments({ ownerUserId: userId, isDeleted: false }),
    Comment.countDocuments({ ownerUserId: userId, isDeleted: false }),
    countReportsAgainstUserContent(userId),
  ]);

  // Check current ban status
  const activeBan = await Ban.findOne({ userId, isActive: true, expiresAt: { $gt: new Date() } });

  // Create audit log
  await AuditLog.create({
    action: 'trace',
    adminId,
    targetUserId: userId,
    targetPostId: postId,
    reason,
  });

  return {
    email: post.ownerUserId.email,
    postCount,
    commentCount,
    reportCount,
    isBanned: !!activeBan,
    banExpiresAt: activeBan?.expiresAt,
    userId,
    relatedPostId: post._id,
  };
}

export async function traceCommentAuthor(commentId, targetType, adminId, reason) {
  if (!reason || !reason.trim()) {
    throw new AppError('请输入追溯原因', 400, 'MISSING_REASON');
  }

  let comment = null;
  let targetOwnerUserId = null;

  if (targetType === 'reply') {
    // 回复是嵌入文档，需要找到包含该回复的评论
    comment = await Comment.findOne({ 'replies._id': commentId }).populate('replies.ownerUserId', 'email');
    if (!comment) {
      throw new AppError('回复不存在', 404, 'REPLY_NOT_FOUND');
    }
    const reply = comment.replies.find(r => r._id.toString() === commentId.toString());
    if (!reply) {
      throw new AppError('回复不存在', 404, 'REPLY_NOT_FOUND');
    }
    targetOwnerUserId = reply.ownerUserId;
  } else {
    // 普通评论
    comment = await Comment.findById(commentId).populate('ownerUserId', 'email');
    if (!comment) {
      throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
    }
    targetOwnerUserId = comment.ownerUserId;
  }

  const userId = targetOwnerUserId._id;
  const relatedPostId = comment.postId || null;
  const [postCount, commentCount, reportCount] = await Promise.all([
    Post.countDocuments({ ownerUserId: userId, isDeleted: false }),
    Comment.countDocuments({ ownerUserId: userId, isDeleted: false }),
    countReportsAgainstUserContent(userId),
  ]);

  const activeBan = await Ban.findOne({ userId, isActive: true, expiresAt: { $gt: new Date() } });

  await AuditLog.create({
    action: 'trace',
    adminId,
    targetUserId: userId,
    targetCommentId: commentId,
    reason,
  });

  return {
    email: targetOwnerUserId.email,
    postCount,
    commentCount,
    reportCount,
    isBanned: !!activeBan,
    banExpiresAt: activeBan?.expiresAt,
    userId,
    relatedPostId,
  };
}

// ─── Banning ───

export async function banUser(userId, { days, reason, relatedPostId, adminId }) {
  if (!reason || !reason.trim()) {
    throw new AppError('请输入封禁原因', 400, 'MISSING_REASON');
  }
  if (!days || days < 1) {
    throw new AppError('封禁天数必须大于 0', 400, 'INVALID_BAN_DAYS');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const ban = await Ban.create({
    userId,
    relatedPostId,
    reason,
    days,
    bannedBy: adminId,
    expiresAt,
    isActive: true,
  });

  // Create audit log
  await AuditLog.create({
    action: 'ban',
    adminId,
    targetUserId: userId,
    targetPostId: relatedPostId,
    targetBanId: ban._id,
    reason,
    days,
  });

  // 触发封禁通知（不等待完成）
  notifyBanned(userId, reason).catch(() => {});

  // Send email notification (async, don't wait)
  let postInfo = {};
  if (relatedPostId) {
    const post = await Post.findById(relatedPostId);
    if (post) {
      postInfo = { postTitle: post.title, postContent: post.content };
    }
  }
  sendBanNotification(user.email, { reason, days, ...postInfo }).catch(console.error);

  return ban;
}

export async function getBans({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  const bans = await Ban.find(query)
    .populate('userId', 'email')
    .populate('relatedPostId', 'title content isDeleted')
    .sort({ createdAt: -1 })
    .lean();

  return bans.map((ban) => ({
    ...ban,
    remainingDays: ban.isActive && new Date(ban.expiresAt) > new Date()
      ? Math.ceil((new Date(ban.expiresAt) - new Date()) / (24 * 60 * 60 * 1000))
      : 0,
    isExpired: new Date(ban.expiresAt) <= new Date(),
  }));
}

export async function unbanUser(banId, { reason, adminId, isManual = true }) {
  const ban = await Ban.findById(banId).populate('userId', 'email');
  if (!ban) {
    throw new AppError('封禁记录不存在', 404, 'BAN_NOT_FOUND');
  }

  if (!ban.isActive) {
    throw new AppError('该用户已解禁', 400, 'BAN_ALREADY_INACTIVE');
  }

  ban.isActive = false;
  ban.unbanReason = reason;
  ban.unbannedAt = new Date();
  await ban.save();

  // Create audit log
  await AuditLog.create({
    action: 'unban',
    adminId,
    targetUserId: ban.userId._id,
    targetBanId: ban._id,
    reason,
    isManual,
  });

  // 触发解封通知（不等待完成）
  notifyUnbanned(ban.userId._id).catch(() => {});

  // Send email notification
  sendUnbanNotification(ban.userId.email, { reason, isManual }).catch(console.error);

  return ban;
}

export async function checkAndExpireBan(userId) {
  const ban = await Ban.findOne({ userId, isActive: true, expiresAt: { $lte: new Date() } });

  if (ban) {
    ban.isActive = false;
    await ban.save();

    // Create audit log for auto-unban
    await AuditLog.create({
      action: 'unban',
      targetUserId: userId,
      targetBanId: ban._id,
      reason: '禁言期已结束',
      isManual: false,
    });

    // Send email notification
    const user = await User.findById(userId);
    if (user) {
      sendUnbanNotification(user.email, { reason: '禁言期已结束', isManual: false }).catch(console.error);
    }

    return true;
  }

  return false;
}

export async function getActiveBan(userId) {
  await checkAndExpireBan(userId);
  return Ban.findOne({ userId, isActive: true, expiresAt: { $gt: new Date() } });
}

// ─── Posts Moderation ───

export async function deletePost(postId, adminId, reason) {
  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  }

  post.isDeleted = true;
  await post.save();

  // Also mark related report as processed (delete it)
  await Report.deleteMany({ targetId: postId, targetType: 'post', status: 'pending' });

  // Create audit log
  await AuditLog.create({
    action: 'delete_post',
    adminId,
    targetUserId: post.ownerUserId,
    targetPostId: postId,
    reason,
  });

  try {
    broadcast('post-deleted', { postId: post._id.toString() });
  } catch (error) {
    console.error('SSE broadcast failed after admin post deletion:', error);
  }

  return post;
}

// ─── Comments Moderation ───

export async function deleteComment(commentId, adminId, reason) {
  // 先尝试作为普通评论删除
  let comment = await Comment.findOne({ _id: commentId, isDeleted: false });

  if (comment) {
    comment.isDeleted = true;
    await comment.save();

    const replyIds = (comment.replies || [])
      .filter((reply) => !reply.isDeleted)
      .map((reply) => reply._id);

    // Mark related reports as processed
    await Report.deleteMany({
      status: 'pending',
      $or: [
        { targetId: commentId, targetType: 'comment' },
        ...(replyIds.length > 0 ? [{ targetId: { $in: replyIds }, targetType: 'reply' }] : []),
      ],
    });

    await syncPostCommentCount(comment.postId);

    // Create audit log
    await AuditLog.create({
      action: 'delete_comment',
      adminId,
      targetUserId: comment.ownerUserId,
      targetCommentId: commentId,
      reason,
    });

    return comment;
  }

  // 如果不是独立评论，可能是嵌入的回复
  const parentComment = await Comment.findOne({
    isDeleted: false,
    replies: { $elemMatch: { _id: commentId, isDeleted: { $ne: true } } },
  });
  if (!parentComment) {
    throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
  }

  // 找到并标记回复为已删除
  const reply = parentComment.replies.id(commentId);
  if (!reply) {
    throw new AppError('回复不存在', 404, 'REPLY_NOT_FOUND');
  }

  reply.isDeleted = true;
  await parentComment.save();

  // Mark related reports as processed
  await Report.deleteMany({ targetId: commentId, targetType: 'reply', status: 'pending' });

  await syncPostCommentCount(parentComment.postId);

  // Create audit log
  await AuditLog.create({
    action: 'delete_comment',
    adminId,
    targetUserId: reply.ownerUserId,
    targetCommentId: commentId,
    reason,
  });

  return reply;
}

// ─── Audit Logs ───

export async function getAuditLogs({ action, limit = 100 } = {}) {
  const query = action ? { action } : {};
  return AuditLog.find(query)
    .populate('adminId', 'email')
    .populate('targetUserId', 'email')
    .populate('targetPostId', 'title')
    .populate('targetEventId', 'title')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
