import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['comment', 'like', 'announcement', 'event_approved', 'event_rejected', 'banned', 'unbanned'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, '标题最多100个字符'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [500, '内容最多500个字符'],
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      enum: ['post', 'comment', 'event', null],
      default: null,
    },
    relatedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
