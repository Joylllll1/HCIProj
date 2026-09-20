import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 100 },
    content: { type: String, maxlength: 20000 },
    moodType: { type: String },
    mood: { type: String },
    tags: [{ type: String, trim: true }],
    images: [{ type: String }],
    image: { type: String },
  },
  { timestamps: true },
);

const Draft = mongoose.model('Draft', draftSchema);
export default Draft;
