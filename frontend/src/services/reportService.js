import { request } from './apiClient';

const API_BASE = '/api/posts';

// Create a report for a post, comment, or reply
export async function createReport(targetId, reason, targetType = 'post') {
  return request(`${API_BASE}/${targetId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, targetType }),
  });
}
