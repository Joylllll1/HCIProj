import { request } from './apiClient';

export async function register(email, password) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuthRefresh: true,
    authFailureMode: 'silent',
  });
}

export async function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuthRefresh: true,
    authFailureMode: 'silent',
  });
}

export async function getMe(options = {}) {
  return request('/api/auth/me', options);
}

export async function refreshToken() {
  return request('/api/auth/refresh', {
    method: 'POST',
    skipAuthRefresh: true,
    authFailureMode: 'silent',
  });
}

export async function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
    skipAuthRefresh: true,
    authFailureMode: 'silent',
  });
}

export async function updateProfile(data) {
  return request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword({ code, newPassword }) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ code, newPassword }),
  });
}
