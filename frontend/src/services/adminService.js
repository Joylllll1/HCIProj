import { request } from './apiClient';

const API_BASE = '/api/admin';

// Reports
export const getReports = () => request(`${API_BASE}/reports`);

export const dismissReport = (reportId) =>
  request(`${API_BASE}/reports/${reportId}/dismiss`, { method: 'POST' });

// Posts
export const tracePost = (targetId, targetType, reason) => {
  const endpoint = targetType === 'comment' || targetType === 'reply'
    ? `${API_BASE}/comments/${targetId}/trace`
    : `${API_BASE}/posts/${targetId}/trace`;
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ reason, targetType }),
  });
};

export const deletePost = (postId, reason) =>
  request(`${API_BASE}/posts/${postId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });

// Comments
export const deleteComment = (commentId, reason) =>
  request(`${API_BASE}/comments/${commentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });

// Users
export const banUser = (userId, { days, reason, relatedPostId }) =>
  request(`${API_BASE}/users/${userId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ days, reason, relatedPostId }),
  });

// Bans
export const getBans = (includeInactive = false) =>
  request(`${API_BASE}/bans?includeInactive=${includeInactive}`);

export const unbanUser = (banId, reason) =>
  request(`${API_BASE}/bans/${banId}/unban`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// Audit Logs
export const getAuditLogs = (action, limit) => {
  const params = new URLSearchParams();
  if (action) params.append('action', action);
  if (limit) params.append('limit', limit);
  return request(`${API_BASE}/audit-logs?${params}`);
};
