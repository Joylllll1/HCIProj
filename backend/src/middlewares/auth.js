import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { extractAccessToken } from '../utils/authCookies.js';

const auth = async (req, _res, next) => {
  const token = extractAccessToken(req);
  if (!token) {
    throw new AppError('未提供认证凭证', 401, 'NO_TOKEN');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token 已过期', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('无效的认证凭证', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
  }

  req.user = user;
  next();
};

export default auth;
