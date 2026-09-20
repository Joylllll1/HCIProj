import Draft from '../models/Draft.js';
import Post from '../models/Post.js';
import AppError from '../utils/AppError.js';
import { normalizeInlineImages } from '../utils/image.js';

const MAX_DRAFTS = 10;

const toDraftDto = (draft) => ({
  ...draft,
  image: draft.image || draft.images?.[0] || '',
  images: Array.isArray(draft.images) && draft.images.length > 0
    ? draft.images
    : draft.image
      ? [draft.image]
      : [],
  id: draft._id.toString(),
});

const normalizeDraftData = (data = {}) => ({
  title: data.title?.trim() || '',
  content: data.content?.trim() || '',
  moodType: data.moodType || null,
  mood: data.mood || '平静',
  tags: Array.isArray(data.tags)
    ? data.tags.map((tag) => tag?.trim()).filter(Boolean)
    : [],
  images: normalizeInlineImages(
    Array.isArray(data.images) ? data.images : data.image ? [data.image] : [],
    { label: '草稿图片' },
  ),
});

const assertDraftContent = (data) => {
  if (!data.content && (!Array.isArray(data.images) || data.images.length === 0)) {
    throw new AppError('请先填写内容或上传图片', 400, 'DRAFT_CONTENT_REQUIRED');
  }
};

export const createDraft = async (userId, data) => {
  const count = await Draft.countDocuments({ ownerUserId: userId });
  if (count >= MAX_DRAFTS) {
    throw new AppError('草稿数量已达上限，请先删除部分草稿', 400, 'DRAFT_LIMIT_EXCEEDED');
  }
  const payload = normalizeDraftData(data);
  assertDraftContent(payload);

  const draft = await Draft.create({ ownerUserId: userId, ...payload });
  return toDraftDto(draft.toObject());
};

export const getDrafts = async (userId) => {
  const drafts = await Draft.find({ ownerUserId: userId })
    .sort({ updatedAt: -1 })
    .lean();
  return drafts.map((d) => toDraftDto(d));
};

export const getDraftById = async (draftId, userId) => {
  const draft = await Draft.findOne({ _id: draftId, ownerUserId: userId }).lean();
  if (!draft) throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');
  return toDraftDto(draft);
};

export const updateDraft = async (draftId, userId, data) => {
  const payload = normalizeDraftData(data);
  assertDraftContent(payload);

  const draft = await Draft.findOneAndUpdate(
    { _id: draftId, ownerUserId: userId },
    { ...payload, updatedAt: new Date() },
    { new: true },
  ).lean();
  if (!draft) throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');
  return toDraftDto(draft);
};

export const deleteDraft = async (draftId, userId) => {
  const result = await Draft.deleteOne({ _id: draftId, ownerUserId: userId });
  if (result.deletedCount === 0) {
    throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');
  }
};

export const deleteDrafts = async (draftIds, userId) => {
  await Draft.deleteMany({ _id: { $in: draftIds }, ownerUserId: userId });
};

export const publishDraft = async (draftId, userId) => {
  const draft = await Draft.findOne({ _id: draftId, ownerUserId: userId });
  if (!draft) throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');
  const images = normalizeInlineImages(
    Array.isArray(draft.images) && draft.images.length > 0
      ? draft.images
      : draft.image
        ? [draft.image]
        : [],
    { label: '草稿图片' },
  );
  const content = draft.content?.trim() || '';
  if (!content && images.length === 0) {
    throw new AppError('草稿内容不能为空', 400, 'DRAFT_CONTENT_REQUIRED');
  }

  const post = await Post.create({
    ownerUserId: userId,
    title: draft.title || '无标题',
    content,
    moodType: draft.moodType || 'calm',
    mood: draft.mood || '平静',
    tags: draft.tags?.length > 0 ? draft.tags : ['树洞'],
    images,
  });

  await Draft.deleteOne({ _id: draftId });

  return {
    ...post.toObject(),
    image: post.images?.[0] || '',
    images: Array.isArray(post.images) ? post.images : [],
    id: post._id.toString(),
    time: formatRelativeTime(post.createdAt),
    isLiked: false,
  };
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
