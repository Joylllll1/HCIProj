import Ban from '../models/Ban.js';
import AppError from '../utils/AppError.js';

const checkBan = async (req, _res, next) => {
  if (!req.user) {
    return next();
  }

  const userId = req.user._id;
  const activeBan = await Ban.findOne({ userId, isActive: true, expiresAt: { $gt: new Date() } });

  if (activeBan) {
    const remainingDays = Math.ceil((activeBan.expiresAt - new Date()) / (24 * 60 * 60 * 1000));
    throw new AppError(`你已被禁言，剩余 ${remainingDays} 天`, 403, 'USER_BANNED', {
      banExpiresAt: activeBan.expiresAt,
      banReason: activeBan.reason,
    });
  }

  // Check for expired bans and deactivate them
  await Ban.updateMany(
    { userId, isActive: true, expiresAt: { $lte: new Date() } },
    { isActive: false }
  );

  next();
};

export default checkBan;
