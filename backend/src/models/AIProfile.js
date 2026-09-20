import mongoose from 'mongoose';
import aiPersonaSchema from './schemas/aiPersonaSchema.js';

const aiProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    persona: {
      type: aiPersonaSchema,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('AIProfile', aiProfileSchema);
