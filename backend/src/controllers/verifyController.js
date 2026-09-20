import VerificationCode from '../models/VerificationCode.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { sendVerificationCode } from '../services/emailService.js';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ensureAuthenticatedChangePasswordRequest(req, email) {
  if (!req.user) {
    throw new AppError('请先登录后再修改密码', 401, 'UNAUTHORIZED_CHANGE_PASSWORD');
  }
  if (req.user.email !== email) {
    throw new AppError('验证码只能发送到当前登录邮箱', 403, 'EMAIL_MISMATCH');
  }
}

export const sendCode = async (req, res) => {
  const { email, type } = req.body;

  if (!email || !type) {
    throw new AppError('邮箱和验证类型不能为空', 400, 'MISSING_PARAMS');
  }

  if (type === 'change_password') {
    ensureAuthenticatedChangePasswordRequest(req, email);
  } else {
    // Check email domain
    const domain = '@' + email.split('@')[1]?.toLowerCase();
    if (!['@nju.edu.cn', '@smail.nju.edu.cn'].includes(domain)) {
      throw new AppError('仅支持 nju.edu.cn 和 smail.nju.edu.cn 邮箱', 400, 'INVALID_DOMAIN');
    }

    // For reset_password, check if user exists
    if (type === 'reset_password') {
      const user = await User.findOne({ email });
      if (!user) {
        throw new AppError('该邮箱尚未注册', 404, 'EMAIL_NOT_FOUND');
      }
    }
  }

  // Generate code and save
  const code = generateCode();
  const expiresAt = new Date(Date.now() + (parseInt(process.env.VERIFY_CODE_EXPIRES_MIN, 10) || 5) * 60 * 1000);

  await VerificationCode.findOneAndUpdate(
    { email, type },
    { code, expiresAt, verified: false },
    { upsert: true, new: true }
  );

  // Send email
  await sendVerificationCode(email, code);

  res.json({ message: '验证码已发送' });
};

export const checkCode = async (req, res) => {
  const { email, code, type } = req.body;

  if (!email || !code || !type) {
    throw new AppError('参数不完整', 400, 'MISSING_PARAMS');
  }

  if (type === 'change_password') {
    ensureAuthenticatedChangePasswordRequest(req, email);
  }

  const record = await VerificationCode.findOne({ email, type, verified: false });

  if (!record) {
    throw new AppError('请先获取验证码', 400, 'CODE_NOT_FOUND');
  }

  if (record.code !== code) {
    throw new AppError('验证码错误', 400, 'CODE_MISMATCH');
  }

  if (record.expiresAt < new Date()) {
    throw new AppError('验证码已过期，请重新发送', 400, 'CODE_EXPIRED');
  }

  // Mark as verified
  record.verified = true;
  await record.save();

  res.json({ message: '验证通过' });
};
