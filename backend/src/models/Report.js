import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['post', 'comment', 'reply'], default: 'post', required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // postId 或 commentId/replyId
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true }, // 所属帖子（评论/回复时填充）
    reportCount: { type: Number, default: 1 },
    reasons: [
      {
        reason: { type: String, required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ['pending', 'processed'], default: 'pending', index: true },
  },
  { timestamps: true }
);

// Compound index for efficient query
reportSchema.index({ status: 1, targetType: 1, reportCount: -1, createdAt: -1 });
reportSchema.index(
  { targetType: 1, targetId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

const Report = mongoose.model('Report', reportSchema);
export default Report;
