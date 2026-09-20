import { request } from './apiClient';

export async function fetchNotifications() {
  return request('/api/notifications');
}

export async function fetchUnreadCount() {
  return request('/api/notifications/unread-count');
}

export async function markNotificationAsRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsAsRead() {
  return request('/api/notifications/read-all', { method: 'PUT' });
}
