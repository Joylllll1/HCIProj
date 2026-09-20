import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { getVisibleCommentCounts } from './commentCountService.js';

export const getUserLikes = async (userId) => {
  // 帖子喜爱：likedBy 含该用户的帖子
  const likedPosts = await Post.find({
    isDeleted: false,
    likedBy: userId,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const visibleCommentCounts = await getVisibleCommentCounts(likedPosts.map((post) => post._id.toString()));

  const posts = likedPosts.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    content: p.content,
    tags: Array.isArray(p.tags) ? p.tags : [],
    mood: p.mood,
    moodType: p.moodType,
    likes: p.likes || 0,
    comments: visibleCommentCounts.get(p._id.toString()) || 0,
    saves: p.saves || 0,
    image: p.image,
    images: Array.isArray(p.images) ? p.images : [],
    createdAt: p.createdAt,
    isLiked: true,
  }));

  // 评论喜爱（评论 + 回复）：所有 likedBy 含该用户的评论和回复，统一展平
  const likedComments = await Comment.find({
    isDeleted: false,
    postId: { $exists: true },
    $or: [
      { likedBy: userId },
      { 'replies.likedBy': userId },
    ],
  })
    .populate('postId', 'title isDeleted')
    .sort({ updatedAt: -1 })
    .lean();

  const comments = [];

  for (const c of likedComments) {
    const postTitle = c.postId?.title || '';
    const postIsDeleted = c.postId?.isDeleted || false;

    // 用户点赞了此评论本身
    if (c.likedBy?.some((id) => id.toString() === userId)) {
      comments.push({
        type: 'comment',
        item: {
          id: c._id.toString(),
          content: c.content,
          likes: c.likes || 0,
          createdAt: c.createdAt,
          official: c.official,
          isLiked: true,
        },
        postId: c.postId?._id?.toString() || c.postId?.toString(),
        postTitle,
        postIsDeleted,
      });
    }

    // 用户点赞了此评论下的回复
    if (c.replies?.length > 0) {
      for (const r of c.replies) {
        if (!r.isDeleted && r.likedBy?.some((id) => id.toString() === userId)) {
          comments.push({
            type: 'reply',
            item: {
              id: r._id.toString(),
              content: r.content,
              likes: r.likes || 0,
              createdAt: r.createdAt,
              official: r.official,
              isLiked: true,
            },
            postId: c.postId?._id?.toString() || c.postId?.toString(),
            postTitle,
            postIsDeleted,
            parentCommentId: c._id.toString(),
          });
        }
      }
    }
  }

  // 按时间倒序排列
  comments.sort((a, b) => new Date(b.item.createdAt) - new Date(a.item.createdAt));

  return { posts, comments };
};
