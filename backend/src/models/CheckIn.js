import mongoose from 'mongoose';

const fortuneEntrySchema = new mongoose.Schema({
  activity: { type: String, required: true },
  description: { type: String, required: true },
});

const checkInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    level: { type: String, required: true },
    dos: [fortuneEntrySchema],
    donts: [fortuneEntrySchema],
  },
  { timestamps: true },
);

checkInSchema.index({ userId: 1, date: 1 }, { unique: true });

const CheckIn = mongoose.model('CheckIn', checkInSchema);
export default CheckIn;
