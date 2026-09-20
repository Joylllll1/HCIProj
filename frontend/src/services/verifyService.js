import { request } from './apiClient';

export async function sendVerifyCode(email, type) {
  return request('/api/verify/send', {
    method: 'POST',
    body: JSON.stringify({ email, type }),
  });
}

export async function checkVerifyCode(email, code, type) {
  return request('/api/verify/check', {
    method: 'POST',
    body: JSON.stringify({ email, code, type }),
  });
}
