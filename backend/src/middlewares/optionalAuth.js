import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { extractAccessToken } from '../utils/authCookies.js';

const optionalAuth = async (req, _res, next) => {
  const token = extractAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    }
  } catch {
    // Token invalid or expired — continue without user
  }

  next();
};

export default optionalAuth;
