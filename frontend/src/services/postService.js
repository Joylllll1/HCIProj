import { request } from './apiClient';

export async function fetchPosts(page = 1, query = '', options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 20;
  const params = new URLSearchParams({ page, limit });
  if (query) params.set('query', query);
  if (options.sort) params.set('sort', options.sort);
  return request(`/api/posts?${params}`);
}

export async function fetchPostById(id) {
  return request(`/api/posts/${id}`);
}

export async function createPost(data) {
  return request('/api/posts', { method: 'POST', body: JSON.stringify(data) });
}

export async function deletePost(id) {
  return request(`/api/posts/${id}`, { method: 'DELETE' });
}

export async function toggleLike(id) {
  return request(`/api/posts/${id}/like`, { method: 'POST' });
}

export async function toggleSave(id) {
  return request(`/api/posts/${id}/save`, { method: 'POST' });
}

export async function fetchLikes() {
  return request('/api/likes');
}

export async function fetchSavedPosts() {
  return request('/api/posts/saved');
}

export async function fetchMyPosts() {
  return request('/api/posts/mine');
}

export async function toggleCommentLike(commentId) {
  return request(`/api/comments/${commentId}/like`, { method: 'POST' });
}

export async function toggleReplyLike(commentId, replyId) {
  return request(`/api/comments/${commentId}/reply/${replyId}/like`, { method: 'POST' });
}
