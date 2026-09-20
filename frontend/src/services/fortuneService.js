import { request } from './apiClient';

export async function getStatus() {
  return request('/api/fortune/status');
}

export async function checkin() {
  return request('/api/fortune/checkin', { method: 'POST' });
}
