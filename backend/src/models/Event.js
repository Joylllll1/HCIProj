import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, '请输入活动名称'],
      trim: true,
      maxlength: [100, '活动名称最多100个字符'],
    },
    type: {
      type: String,
      required: [true, '请选择活动类型'],
      enum: {
        values: ['官方活动', '学术讲座', '体育赛事', '科技竞赛', '志愿公益', '答辩', '校招'],
        message: '无效的活动类型',
      },
    },
    place: {
      type: String,
      required: [true, '请输入活动地点'],
      trim: true,
      maxlength: [200, '活动地点最多200个字符'],
    },
    time: {
      type: Date,
      required: [true, '请选择活动时间'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, '活动简介最多2000个字符'],
    },
    image: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'archived', 'deleted'],
      default: 'pending',
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, '拒绝原因最多500个字符'],
    },
    // Applicant contact info (for admin review only)
    applicantName: {
      type: String,
      trim: true,
      maxlength: [50, '姓名最多50个字符'],
    },
    applicantStudentId: {
      type: String,
      trim: true,
      maxlength: [20, '学号最多20个字符'],
    },
    applicantPhone: {
      type: String,
      trim: true,
      maxlength: [20, '手机号最多20个字符'],
    },
    applicantQQ: {
      type: String,
      trim: true,
      maxlength: [20, 'QQ号最多20个字符'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for querying by status and time
eventSchema.index({ status: 1, createdAt: -1 });
eventSchema.index({ status: 1, reviewedAt: -1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
