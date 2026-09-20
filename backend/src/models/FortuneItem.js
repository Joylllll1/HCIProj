import mongoose from 'mongoose';

const fortuneItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['dos', 'donts'],
    required: true,
    index: true,
  },
  activity: { type: String, required: true },
  description: { type: String, required: true },
});

const FortuneItem = mongoose.model('FortuneItem', fortuneItemSchema);
export default FortuneItem;
