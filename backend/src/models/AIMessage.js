import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AISession',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    reasoningContent: {
      type: String,
      default: '',
    },
    contextSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying by session and creation time
aiMessageSchema.index({ session: 1, createdAt: 1 });

export default mongoose.model('AIMessage', aiMessageSchema);
