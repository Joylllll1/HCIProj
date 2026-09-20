import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import AppError from '../utils/AppError.js';

export const forgot = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('请输入邮箱地址', 400, 'MISSING_EMAIL');
  }

  // Check if user exists
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('该邮箱尚未注册', 404, 'EMAIL_NOT_FOUND');
  }

  // Verification code is generated and sent via verifyRoutes — client calls
  // POST /api/verify/send with type=reset_password, then uses the code here
  res.json({ message: '验证码已发送到您的邮箱', email });
};

export const reset = async (req, res) => {
  const { email, code, password } = req.body;

  if (!email || !code || !password) {
    throw new AppError('参数不完整', 400, 'MISSING_PARAMS');
  }

  // Verify code
  const record = await VerificationCode.findOne({ email, type: 'reset_password', verified: true });
  if (!record) {
    throw new AppError('请先完成邮箱验证', 400, 'CODE_NOT_VERIFIED');
  }
  if (record.expiresAt <= new Date()) {
    await VerificationCode.deleteMany({ email, type: 'reset_password' });
    throw new AppError('验证码已过期，请重新发送', 400, 'CODE_EXPIRED');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AppError('密码至少 8 位', 400, 'WEAK_PASSWORD');
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError('密码需包含字母和数字', 400, 'WEAK_PASSWORD');
  }

  // Update password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
  }

  user.password = password;
  await user.save();

  // Invalidate the verification record
  await VerificationCode.deleteOne({ _id: record._id });

  res.json({ message: '密码重置成功，请重新登录' });
};
