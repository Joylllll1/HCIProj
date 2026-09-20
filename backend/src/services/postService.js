import Post from '../models/Post.js';
import AppError from '../utils/AppError.js';
import { notifyLike } from './notificationService.js';
import { broadcast } from './sseManager.js';
import { getVisibleCommentCounts, getVisibleCommentCount } from './commentCountService.js';
import { normalizeInlineImages } from '../utils/image.js';

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeFeedSort(sort) {
  return sort === 'hot' ? 'hot' : 'latest';
}

function resolveFeedSort(sort) {
  return normalizeFeedSort(sort) === 'hot'
    ? { likes: -1, createdAt: -1 }
    : { createdAt: -1 };
}

function broadcastPostStats(post) {
  try {
    broadcast('post-stats-updated', {
      postId: post._id.toString(),
      likes: Math.max(0, post.likes || 0),
      saves: Math.max(0, post.saves || 0),
    });
  } catch (error) {
    console.error('SSE broadcast failed after post stats update:', error);
  }
}

function toPostDto(post, userId) {
  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
      ? [post.image]
      : [];

  return {
    ...post,
    tags: Array.isArray(post.tags) ? post.tags : [],
    image: images[0] || '',
    images,
    id: post._id.toString(),
    time: formatRelativeTime(post.createdAt),
    likes: post.likes || 0,
    comments: post.visibleCommentCount ?? post.comments ?? 0,
    saves: post.saves || 0,
    isLiked: userId ? post.likedBy?.some((id) => id.toString() === userId) : false,
    isSaved: userId ? post.savedBy?.some((id) => id.toString() === userId) : false,
  };
}

export const createPost = async (userId, data) => {
  const sourceImages = Array.isArray(data.images)
    ? data.images
    : data.image
      ? [data.image]
      : [];

  const images = normalizeInlineImages(sourceImages, { label: '帖子图片' });
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  const tags = Array.isArray(data.tags)
    ? data.tags.map((tag) => tag?.trim()).filter(Boolean)
    : [];

  if (!content && images.length === 0) {
    throw new AppError('请先填写内容或上传图片', 400, 'POST_CONTENT_REQUIRED');
  }

  const post = await Post.create({
    ownerUserId: userId,
    ...data,
    title: title || '无标题',
    content,
    tags: tags.length > 0 ? tags : ['树洞'],
    images,
  });
  try {
    broadcast('new-post', {});
  } catch (error) {
    console.error('SSE broadcast failed after post creation:', error);
  }
  return toPostDto(post.toObject(), userId);
};

export const getPosts = async ({ page = 1, limit = 20, query, sort = 'latest', userId } = {}) => {
  const filter = { isDeleted: false };
  if (query && query.trim()) {
    const pattern = new RegExp(escapeRegex(query.trim()), 'i');
    filter.$or = [
      { title: pattern },
      { content: pattern },
      { tags: pattern },
    ];
  }

  const skip = (page - 1) * limit;
  const sortSpec = resolveFeedSort(sort);
  const [posts, total] = await Promise.all([
    Post.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);

  const visibleCommentCounts = await getVisibleCommentCounts(posts.map((post) => post._id.toString()));
  const postsWithLikeStatus = posts.map((p) => toPostDto({
    ...p,
    visibleCommentCount: visibleCommentCounts.get(p._id.toString()) || 0,
  }, userId));

  return {
    posts: postsWithLikeStatus,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getPostById = async (postId, userId) => {
  const post = await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');

  const visibleCommentCount = await getVisibleCommentCount(post._id.toString());
  return toPostDto({ ...post, visibleCommentCount }, userId);
};

export const deletePost = async (userId, postId) => {
  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  if (post.ownerUserId.toString() !== userId) {
    throw new AppError('无权删除此帖子', 403, 'FORBIDDEN');
  }
  post.isDeleted = true;
  await post.save();
  try {
    broadcast('post-deleted', { postId: post._id.toString() });
  } catch (error) {
    console.error('SSE broadcast failed after post deletion:', error);
  }
};

export const toggleLike = async (userId, postId) => {
  const unlikedPost = await Post.findOneAndUpdate(
    { _id: postId, isDeleted: false, likedBy: userId },
    { $pull: { likedBy: userId }, $inc: { likes: -1 } },
    { new: true }
  ).lean();

  if (unlikedPost) {
    broadcastPostStats(unlikedPost);
    return { liked: false, likes: Math.max(0, unlikedPost.likes || 0) };
  }

  const likedPost = await Post.findOneAndUpdate(
    { _id: postId, isDeleted: false, likedBy: { $ne: userId } },
    { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
    { new: true }
  ).lean();

  if (likedPost) {
    if (likedPost.ownerUserId.toString() !== userId) {
      notifyLike(likedPost.ownerUserId, likedPost.title, postId).catch(() => {});
    }
    broadcastPostStats(likedPost);
    return { liked: true, likes: likedPost.likes || 0 };
  }

  const post = await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');

  return {
    liked: post.likedBy?.some((id) => id.toString() === userId) || false,
    likes: post.likes || 0,
  };
};

export const toggleSave = async (userId, postId) => {
  const unsavedPost = await Post.findOneAndUpdate(
    { _id: postId, isDeleted: false, savedBy: userId },
    { $pull: { savedBy: userId }, $inc: { saves: -1 } },
    { new: true }
  ).lean();

  if (unsavedPost) {
    broadcastPostStats(unsavedPost);
    return { saved: false, saves: Math.max(0, unsavedPost.saves || 0) };
  }

  const savedPost = await Post.findOneAndUpdate(
    { _id: postId, isDeleted: false, savedBy: { $ne: userId } },
    { $addToSet: { savedBy: userId }, $inc: { saves: 1 } },
    { new: true }
  ).lean();

  if (savedPost) {
    broadcastPostStats(savedPost);
    return { saved: true, saves: savedPost.saves || 0 };
  }

  const post = await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');

  return {
    saved: post.savedBy?.some((id) => id.toString() === userId) || false,
    saves: post.saves || 0,
  };
};

export const getSavedPosts = async (userId) => {
  const posts = await Post.find({ isDeleted: false, savedBy: userId })
    .sort({ updatedAt: -1 })
    .lean();

  const visibleCommentCounts = await getVisibleCommentCounts(posts.map((post) => post._id.toString()));

  return posts.map((p) => ({
    ...toPostDto({
      ...p,
      visibleCommentCount: visibleCommentCounts.get(p._id.toString()) || 0,
    }, userId),
    isSaved: true,
  }));
};

export const getMyPosts = async (userId) => {
  const posts = await Post.find({ ownerUserId: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  const visibleCommentCounts = await getVisibleCommentCounts(posts.map((post) => post._id.toString()));

  return posts.map((p) => toPostDto({
    ...p,
    visibleCommentCount: visibleCommentCounts.get(p._id.toString()) || 0,
  }, userId));
};

// ─── Helpers ───

function formatRelativeTime(date) {
  if (!date) return '';
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}
