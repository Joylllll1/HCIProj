import * as adminService from '../services/adminService.js';
import AppError from '../utils/AppError.js';

export async function create(req, res) {
  const { id: targetId } = req.params;
  const { reason, targetType = 'post' } = req.body;
  const userId = req.user._id;

  if (!reason || !reason.trim()) {
    throw new AppError('请选择或输入举报原因', 400, 'MISSING_REASON');
  }

  try {
    const report = await adminService.createReport(targetId, targetType, reason, userId);
    res.status(201).json({ message: '举报已提交', report });
  } catch (err) {
    if (err.code === 'ALREADY_REPORTED') {
      throw new AppError(err.message, 400, 'ALREADY_REPORTED');
    }
    throw err;
  }
}
