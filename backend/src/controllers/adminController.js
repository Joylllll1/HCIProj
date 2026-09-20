import * as adminService from '../services/adminService.js';

// ─── Reports ───

export async function getReports(_req, res) {
  const reports = await adminService.getPendingReports();
  res.json({ reports });
}

export async function dismissReport(req, res) {
  const { id } = req.params;
  await adminService.dismissReport(id);
  res.json({ message: '举报已驳回' });
}

// ─── Posts ───

export async function tracePost(req, res) {
  const { id: targetId } = req.params;
  const { reason, targetType = 'post' } = req.body;
  const adminId = req.user._id;

  if (targetType === 'comment' || targetType === 'reply') {
    const result = await adminService.traceCommentAuthor(targetId, targetType, adminId, reason);
    res.json(result);
  } else {
    const result = await adminService.tracePostAuthor(targetId, adminId, reason);
    res.json(result);
  }
}

export async function deletePost(req, res) {
  const { id: postId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  await adminService.deletePost(postId, adminId, reason);
  res.json({ message: '帖子已删除' });
}

export async function deleteComment(req, res) {
  const { id: commentId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  await adminService.deleteComment(commentId, adminId, reason);
  res.json({ message: '评论已删除' });
}

// ─── Users ───

export async function banUser(req, res) {
  const { id: userId } = req.params;
  const { days, reason, relatedPostId } = req.body;
  const adminId = req.user._id;

  const ban = await adminService.banUser(userId, { days, reason, relatedPostId, adminId });
  res.json({ message: '用户已封禁', ban });
}

// ─── Bans ───

export async function getBans(req, res) {
  const { includeInactive } = req.query;
  const bans = await adminService.getBans({ includeInactive: includeInactive === 'true' });
  res.json({ bans });
}

export async function unbanUser(req, res) {
  const { id: banId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const ban = await adminService.unbanUser(banId, { reason, adminId });
  res.json({ message: '用户已解禁', ban });
}

// ─── Audit Logs ───

export async function getAuditLogs(req, res) {
  const { action, limit } = req.query;
  const parsedLimit = Number.parseInt(limit, 10);
  const logs = await adminService.getAuditLogs({
    action,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  });
  res.json({ logs });
}
