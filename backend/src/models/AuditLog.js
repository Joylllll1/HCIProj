import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['trace', 'ban', 'unban', 'delete_post', 'delete_comment', 'approve_event', 'reject_event', 'archive_event', 'delete_event'],
      required: true,
      index: true,
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    targetEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    targetBanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ban' },
    reason: { type: String },
    days: { type: Number },
    isManual: { type: Boolean },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for querying by action and time
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
