import Event from '../models/Event.js';
import AuditLog from '../models/AuditLog.js';
import AppError from '../utils/AppError.js';
import { notifyAnnouncementBroadcast, notifyEventApproved, notifyEventRejected } from './notificationService.js';

const MAX_EVENT_IMAGE_BYTES = 3 * 1024 * 1024;

function ensureApplicantField(value, message, errorCode) {
  if (!value || !value.trim()) {
    throw new AppError(message, 400, errorCode);
  }
}

async function ensureEventExistsAndStatus(eventId, expectedStatus, invalidStatusMessage) {
  const event = await Event.findById(eventId).select('status');

  if (!event) {
    throw new AppError('活动不存在', 404, 'EVENT_NOT_FOUND');
  }

  if (event.status !== expectedStatus) {
    throw new AppError(invalidStatusMessage, 400, 'INVALID_STATUS');
  }
}

// ─── Event Creation ───

export async function createEvent(eventData, userId) {
  const { title, type, place, time, description, image, applicantName, applicantStudentId, applicantPhone, applicantQQ } = eventData;

  // Validate required fields
  if (!title || !title.trim()) {
    throw new AppError('请输入活动名称', 400, 'MISSING_TITLE');
  }
  if (!type) {
    throw new AppError('请选择活动类型', 400, 'MISSING_TYPE');
  }
  if (!place || !place.trim()) {
    throw new AppError('请输入活动地点', 400, 'MISSING_PLACE');
  }
  if (!time) {
    throw new AppError('请选择活动时间', 400, 'MISSING_TIME');
  }
  ensureApplicantField(applicantName, '请输入申请人姓名', 'MISSING_APPLICANT_NAME');
  ensureApplicantField(applicantStudentId, '请输入申请人学号', 'MISSING_APPLICANT_STUDENT_ID');
  ensureApplicantField(applicantPhone, '请输入申请人手机号', 'MISSING_APPLICANT_PHONE');
  ensureApplicantField(applicantQQ, '请输入申请人QQ号', 'MISSING_APPLICANT_QQ');
  if (image && Buffer.byteLength(image, 'utf8') > MAX_EVENT_IMAGE_BYTES) {
    throw new AppError('活动海报过大，请上传 3MB 以内图片', 400, 'IMAGE_TOO_LARGE');
  }

  const event = await Event.create({
    title: title.trim(),
    type,
    place: place.trim(),
    time: new Date(time),
    description: description?.trim() || '',
    image: image?.trim() || '',
    status: 'pending',
    submittedBy: userId,
    applicantName: applicantName?.trim() || '',
    applicantStudentId: applicantStudentId?.trim() || '',
    applicantPhone: applicantPhone?.trim() || '',
    applicantQQ: applicantQQ?.trim() || '',
  });

  return event;
}

// ─── Event Queries ───

export async function getPendingEvents() {
  return Event.find({ status: 'pending' })
    .populate('submittedBy', 'email nickname')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getApprovedEvents() {
  return Event.find({ status: 'approved' })
    .populate('submittedBy', 'email nickname')
    .populate('reviewedBy', 'email nickname')
    .sort({ reviewedAt: -1 })
    .lean();
}

export async function getRejectedEvents() {
  return Event.find({ status: 'rejected' })
    .populate('submittedBy', 'email nickname')
    .populate('reviewedBy', 'email nickname')
    .sort({ reviewedAt: -1 })
    .lean();
}

export async function getArchivedEvents() {
  return Event.find({ status: 'archived' })
    .populate('submittedBy', 'email nickname')
    .populate('reviewedBy', 'email nickname')
    .sort({ reviewedAt: -1 })
    .lean();
}

export async function getPublicEvents() {
  // Public events include archived items so the announcement page can render "past events".
  return Event.find({ status: { $in: ['approved', 'archived'] } })
    .select('title type place time description image reviewedAt status')
    .sort({ reviewedAt: -1 })
    .lean();
}

export async function getMyEvents(userId) {
  return Event.find({ submittedBy: userId })
    .select('title type place time description image status reviewedAt rejectionReason createdAt')
    .sort({ createdAt: -1 })
    .lean();
}

// ─── Event Actions ───

export async function approveEvent(eventId, adminId) {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: 'pending' },
    {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: '',
    },
    { new: true, runValidators: true }
  );

  if (!event) {
    await ensureEventExistsAndStatus(eventId, 'pending', '只能审核待处理的活动');
  }

  // Create audit log
  await AuditLog.create({
    action: 'approve_event',
    adminId,
    targetUserId: event.submittedBy,
    targetEventId: event._id,
    reason: '活动审核通过',
  });

  // 触发审核通过通知（不等待完成）
  notifyEventApproved(event.submittedBy, event.title, event._id).catch(() => {});
  notifyAnnouncementBroadcast(event.title, event._id, { excludeUserIds: [event.submittedBy] }).catch(() => {});

  return event;
}

export async function rejectEvent(eventId, adminId, reason) {
  if (!reason || !reason.trim()) {
    throw new AppError('请填写拒绝原因', 400, 'MISSING_REASON');
  }

  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: 'pending' },
    {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: reason.trim(),
    },
    { new: true, runValidators: true }
  );

  if (!event) {
    await ensureEventExistsAndStatus(eventId, 'pending', '只能审核待处理的活动');
  }

  // Create audit log
  await AuditLog.create({
    action: 'reject_event',
    adminId,
    targetUserId: event.submittedBy,
    targetEventId: event._id,
    reason: reason.trim(),
  });

  // 触发审核拒绝通知（不等待完成）
  notifyEventRejected(event.submittedBy, event.title, reason.trim(), event._id).catch(() => {});

  return event;
}

export async function archiveEvent(eventId, adminId) {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: 'approved' },
    { status: 'archived' },
    { new: true, runValidators: true }
  );

  if (!event) {
    await ensureEventExistsAndStatus(eventId, 'approved', '只能归档已通过的活动');
  }

  // Create audit log
  await AuditLog.create({
    action: 'archive_event',
    adminId,
    targetUserId: event.submittedBy,
    targetEventId: event._id,
    reason: '活动归档',
  });

  return event;
}

export async function deleteEvent(eventId, adminId) {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: 'approved' },
    { status: 'deleted' },
    { new: true, runValidators: true }
  );

  if (!event) {
    await ensureEventExistsAndStatus(eventId, 'approved', '只能删除已通过的活动');
  }

  await AuditLog.create({
    action: 'delete_event',
    adminId,
    targetUserId: event.submittedBy,
    targetEventId: event._id,
    reason: '活动下架删除',
  });

  return event;
}
