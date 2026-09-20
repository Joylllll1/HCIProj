import { clearAuthCookies, setAuthCookies } from './authCookies.js';

export function sendAuthSuccess(res, statusCode, payload) {
  const { accessToken, refreshToken, ...rest } = payload;

  if (accessToken && refreshToken) {
    setAuthCookies(res, accessToken, refreshToken);
  }

  return res.status(statusCode).json(rest);
}

export function sendLoggedOut(res) {
  clearAuthCookies(res);
  return res.json({ message: '已退出登录' });
}
