import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, '请输入邮箱地址'],
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, '验证码不能为空'],
    },
    type: {
      type: String,
      enum: ['register', 'reset_password', 'change_password'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL — auto-delete when expired
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

export default VerificationCode;
