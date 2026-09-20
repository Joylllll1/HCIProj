import * as authService from '../services/authService.js';
import { extractRefreshToken } from '../utils/authCookies.js';
import { sendAuthSuccess, sendLoggedOut } from '../utils/authResponse.js';

export const register = async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.register(email, password);
  sendAuthSuccess(res, 201, result);
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  sendAuthSuccess(res, 200, result);
};

export const getMe = async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ user });
};

export const refresh = async (req, res) => {
  const refreshToken = extractRefreshToken(req);
  const result = await authService.refreshToken(refreshToken);
  sendAuthSuccess(res, 200, result);
};

export const logout = async (_req, res) => {
  await authService.logout();
  sendLoggedOut(res);
};

export const updateProfile = async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body);
  res.json(result);
};

export const changePassword = async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  res.json(result);
};
