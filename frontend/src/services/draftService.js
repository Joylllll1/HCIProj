import { request } from './apiClient';

export async function createDraft(data) {
  return request('/api/drafts', { method: 'POST', body: JSON.stringify(data) });
}

export async function fetchDrafts() {
  return request('/api/drafts');
}

export async function fetchDraftById(id) {
  return request(`/api/drafts/${id}`);
}

export async function updateDraft(id, data) {
  return request(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDraft(id) {
  return request(`/api/drafts/${id}`, { method: 'DELETE' });
}

export async function deleteDrafts(ids) {
  return request('/api/drafts/delete-many', { method: 'POST', body: JSON.stringify({ ids }) });
}

export async function publishDraft(id) {
  return request(`/api/drafts/${id}/publish`, { method: 'POST' });
}