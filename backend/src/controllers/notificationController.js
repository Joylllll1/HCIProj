import * as notificationService from '../services/notificationService.js';
import AppError from '../utils/AppError.js';

// ─── Authenticated Routes ───

export async function getNotifications(req, res) {
  const userId = req.user._id;
  const notifications = await notificationService.getNotifications(userId);
  res.json({ notifications });
}

export async function getUnreadCount(req, res) {
  const userId = req.user._id;
  const count = await notificationService.getUnreadCount(userId);
  res.json({ count });
}

export async function markAsRead(req, res) {
  const { id: notificationId } = req.params;
  const userId = req.user._id;

  if (!/^[a-f\d]{24}$/i.test(notificationId)) {
    throw new AppError('通知ID无效', 400, 'INVALID_NOTIFICATION_ID');
  }

  const notification = await notificationService.markAsRead(notificationId, userId);
  if (!notification) {
    return res.status(404).json({ message: '通知不存在' });
  }
  res.json({ notification });
}

export async function markAllAsRead(req, res) {
  const userId = req.user._id;
  const count = await notificationService.markAllAsRead(userId);
  res.json({ message: '已全部标记为已读', count });
}
