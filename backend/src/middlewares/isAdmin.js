import AppError from '../utils/AppError.js';

const isAdmin = (req, _res, next) => {
  if (!req.user) {
    throw new AppError('未提供认证凭证', 401, 'NO_TOKEN');
  }

  if (req.user.role !== 'admin') {
    throw new AppError('无权限访问', 403, 'FORBIDDEN');
  }

  next();
};

export default isAdmin;
