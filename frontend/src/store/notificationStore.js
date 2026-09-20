import { create } from 'zustand';
import * as notificationService from '../services/notificationService';

// Merge like notifications for the same post
function mergeLikeNotifications(notifications) {
  const merged = [];
  const likeGroups = new Map();

  notifications.forEach((n) => {
    if (n.type === 'like' && n.relatedId) {
      const key = n.relatedId.toString();
      if (!likeGroups.has(key)) {
        likeGroups.set(key, {
          ...n,
          _likeCount: 1,
          _likeIds: [n._id],
          _unreadLikeCount: n.read ? 0 : 1,
        });
      } else {
        const group = likeGroups.get(key);
        group._likeCount += 1;
        group._likeIds.push(n._id);
        // Update to most recent
        if (new Date(n.createdAt) > new Date(group.createdAt)) {
          group.createdAt = n.createdAt;
          group._id = n._id;
        }
        // If any is unread, group is unread
        if (!n.read) {
          group.read = false;
          group._unreadLikeCount += 1;
        }
      }
    } else {
      merged.push(n);
    }
  });

  // Convert like groups to merged notifications
  likeGroups.forEach((group) => {
    merged.push({
      ...group,
      title: '收到新点赞',
      content: `你的帖子《${group.relatedData?.postTitle || '未知帖子'}》收到了新的点赞`,
      _isMerged: true,
      _likeIds: group._likeIds,
      _unreadLikeCount: group._unreadLikeCount,
    });
  });

  // Sort by createdAt desc
  return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

const useNotificationStore = create((set, get) => ({
  // State
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  // Actions
  setNotifications: (notifications) => {
    const merged = mergeLikeNotifications(notifications);
    set({ notifications: merged });
  },

  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const data = await notificationService.fetchNotifications();
      const notifications = data.notifications || [];
      const merged = mergeLikeNotifications(notifications);
      set({ notifications: merged, loading: false });
      return merged;
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await notificationService.fetchUnreadCount();
      set({ unreadCount: data.count || 0 });
      return data.count || 0;
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
      return 0;
    }
  },

  markAsRead: async (notificationId) => {
    try {
      // Optimistic update
      const { notifications } = get();
      const notification = notifications.find((n) => n._id === notificationId);

      if (notification && !notification.read) {
        // Handle merged likes
        if (notification._isMerged && notification._likeIds) {
          const unreadLikeCount = notification._unreadLikeCount || 0;
          // Mark all likes in this group as read
          set({
            notifications: notifications.map((n) =>
              n._id === notificationId
                ? { ...n, read: true, _unreadLikeCount: 0 }
                : n
            ),
            unreadCount: Math.max(0, get().unreadCount - unreadLikeCount),
          });
          // Mark all on server
          await Promise.all(
            notification._likeIds.map((id) => notificationService.markNotificationAsRead(id))
          );
        } else {
          set({
            notifications: notifications.map((n) =>
              n._id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, get().unreadCount - 1),
          });
          await notificationService.markNotificationAsRead(notificationId);
        }
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
      // Revert on error by refetching
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  markAllAsRead: async () => {
    try {
      // Optimistic update
      set({
        notifications: get().notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      });
      await notificationService.markAllNotificationsAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      // Revert on error
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  // For use with polling hook
  refresh: async () => {
    await Promise.all([get().fetchNotifications(), get().fetchUnreadCount()]);
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
    });
  },
}));

export default useNotificationStore;
