import mongoose from 'mongoose';

const replySchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      default: '',
      maxlength: 2000,
      validate: {
        validator(value) {
          return Boolean((value && value.trim()) || this.image);
        },
        message: '请输入内容或上传图片',
      },
    },
    image: { type: String, trim: true },
    official: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // 回复的目标：replyToId 为 null 表示回复评论，否则为被回复的回复ID
    replyToId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const commentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: {
      type: String,
      default: '',
      maxlength: 2000,
      validate: {
        validator(value) {
          return Boolean((value && value.trim()) || this.image);
        },
        message: '请输入内容或上传图片',
      },
    },
    image: { type: String, trim: true },
    official: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false, index: true },
    replies: [replySchema],
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
