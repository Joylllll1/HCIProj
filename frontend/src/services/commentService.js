import { request } from './apiClient';

export async function createComment(postId, content, image = '', official = false) {
  return request('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ postId, content, image, official }),
  });
}

export async function getComments(postId) {
  return request(`/api/comments/${postId}`);
}

export async function deleteComment(commentId) {
  return request(`/api/comments/${commentId}`, { method: 'DELETE' });
}

export async function toggleLike(commentId) {
  return request(`/api/comments/${commentId}/like`, { method: 'POST' });
}

export async function addReply(commentId, content, image = '', official = false, replyToId = null) {
  return request(`/api/comments/${commentId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content, image, official, replyToId }),
  });
}

export async function toggleReplyLike(commentId, replyId) {
  return request(`/api/comments/${commentId}/reply/${replyId}/like`, { method: 'POST' });
}

export async function deleteReply(commentId, replyId) {
  return request(`/api/comments/${commentId}/reply/${replyId}`, { method: 'DELETE' });
}
