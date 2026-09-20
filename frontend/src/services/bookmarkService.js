import request from './apiClient';

export async function fetchBookmarks() {
  return request('/api/bookmarks');
}

export async function migrateLegacyBookmarks(data) {
  return request('/api/bookmarks/migrate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createBookmarkFolder(name) {
  return request('/api/bookmarks/folders', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameBookmarkFolder(folderId, name) {
  return request(`/api/bookmarks/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteBookmarkFolder(folderId) {
  return request(`/api/bookmarks/folders/${folderId}`, {
    method: 'DELETE',
  });
}

export async function saveBookmark(postId, folderId) {
  return request(`/api/bookmarks/${postId}`, {
    method: 'POST',
    body: JSON.stringify({ folderId }),
  });
}

export async function removeBookmark(postId) {
  return request(`/api/bookmarks/${postId}`, {
    method: 'DELETE',
  });
}
