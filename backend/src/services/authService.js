import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import Ban from '../models/Ban.js';
import { sendUnbanNotification } from './emailService.js';
import AppError from '../utils/AppError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const ALLOWED_DOMAINS = ['@nju.edu.cn', '@smail.nju.edu.cn'];

export const register = async (email, password) => {
  // Validate email domain
  const domain = '@' + email.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    throw new AppError('仅支持 nju.edu.cn 和 smail.nju.edu.cn 邮箱', 400, 'INVALID_DOMAIN');
  }

  // Validate password strength
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError('密码至少 8 位，需包含字母和数字', 400, 'WEAK_PASSWORD');
  }

  // Check if email already exists
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('该邮箱已被注册', 409, 'EMAIL_EXISTS');
  }

  // Verify email code
  const verifiedCode = await VerificationCode.findOne({ email, type: 'register', verified: true });
  if (!verifiedCode) {
    throw new AppError('请先完成邮箱验证', 400, 'CODE_NOT_VERIFIED');
  }
  if (verifiedCode.expiresAt <= new Date()) {
    await VerificationCode.deleteMany({ email, type: 'register' });
    throw new AppError('验证码已过期，请重新验证', 400, 'CODE_EXPIRED');
  }

  // Create user
  const user = await User.create({ email, password });

  // Clean up used verification code
  await VerificationCode.deleteMany({ email, type: 'register' });

  // Generate tokens
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

export const login = async (email, password) => {
  // Find user with password field included
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  // Check for expired bans and auto-unban
  const expiredBan = await Ban.findOne({ userId: user._id, isActive: true, expiresAt: { $lte: new Date() } });
  if (expiredBan) {
    expiredBan.isActive = false;
    await expiredBan.save();
    sendUnbanNotification(email, { reason: '禁言期已结束', isManual: false }).catch(console.error);
  }

  // Check active ban
  const activeBan = await Ban.findOne({ userId: user._id, isActive: true, expiresAt: { $gt: new Date() } });
  const banInfo = activeBan ? {
    isBanned: true,
    banExpiresAt: activeBan.expiresAt,
    banReason: activeBan.reason,
  } : { isBanned: false };

  // Generate tokens
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  return {
    user: { ...user.toJSON(), ...banInfo },
    accessToken,
    refreshToken,
  };
};

export const refreshToken = async (token) => {
  if (!token) {
    throw new AppError('登录已过期，请重新登录', 401, 'NO_REFRESH_TOKEN');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError('登录已过期，请重新登录', 401, 'TOKEN_EXPIRED');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
  }

  const accessToken = signAccessToken(user.id);
  const newRefreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
  }
  return user.toJSON();
};

export const logout = async () => {
  return { message: '已退出登录' };
};

export const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
  }

  if (data.notificationPreferences) {
    const { reply, like, announcement, reportResult } = data.notificationPreferences;
    if (reply !== undefined) user.notificationPreferences.reply = reply;
    if (like !== undefined) user.notificationPreferences.like = like;
    if (announcement !== undefined) user.notificationPreferences.announcement = announcement;
    if (reportResult !== undefined) user.notificationPreferences.reportResult = reportResult;
  }

  await user.save();
  return { user: user.toJSON() };
};

export const changePassword = async (userId, { code, newPassword }) => {
  if (!code || !newPassword) {
    throw new AppError('参数不完整', 400, 'MISSING_PARAMS');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
  }

  const normalizedCode = String(code).trim();

  // Verify code
  const record = await VerificationCode.findOne({
    email: user.email,
    type: 'change_password',
    code: normalizedCode,
    verified: true,
  });
  if (!record) {
    throw new AppError('验证码无效或尚未验证', 400, 'CODE_NOT_VERIFIED');
  }
  if (record.expiresAt <= new Date()) {
    await VerificationCode.deleteMany({ email: user.email, type: 'change_password' });
    throw new AppError('验证码已过期，请重新发送', 400, 'CODE_EXPIRED');
  }

  // Validate password strength
  if (newPassword.length < 8) {
    throw new AppError('密码至少 8 位', 400, 'WEAK_PASSWORD');
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new AppError('密码需包含字母和数字', 400, 'WEAK_PASSWORD');
  }

  user.password = newPassword;
  await user.save();

  await VerificationCode.deleteOne({ _id: record._id });

  return { message: '密码修改成功' };
};
