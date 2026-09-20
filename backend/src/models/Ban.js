import mongoose from 'mongoose';

const banSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relatedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    reason: { type: String, required: true },
    days: { type: Number, required: true },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    unbanReason: { type: String },
    unbannedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for active bans lookup
banSchema.index({ userId: 1, isActive: 1, expiresAt: 1 });

const Ban = mongoose.model('Ban', banSchema);
export default Ban;
