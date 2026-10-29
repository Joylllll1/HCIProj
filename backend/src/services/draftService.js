import Draft from '../models/Draft.js';
import Post from '../models/Post.js';
import AppError from '../utils/AppError.js';
import {
  getImageEncodedBytes,
  storeInlineImages,
  storeTrustedImages,
} from './imageStorage.js';
import { serializeDraftMedia, serializePostMedia } from '../utils/media.js';
import { broadcast } from './sseManager.js';

const MAX_DRAFTS = 10;

const getDraftImages = (draft) => (Array.isArray(draft.images) && draft.images.length > 0
    ? draft.images
    : draft.image
      ? [draft.image]
      : []);

const toDraftDto = async (draft) => {
  const images = getDraftImages(draft);
  const imageBytes = await Promise.all(images.map((image) => getImageEncodedBytes(image)));
  return serializeDraftMedia({
    ...draft,
    image: images[0] || '',
    images,
    imageBytes,
    id: draft._id.toString(),
  });
};

const normalizeDraftData = async (data = {}, currentDraft = null) => {
  const sourceImages = Array.isArray(data.images)
    ? data.images
    : data.image
      ? [data.image]
      : [];
  let images;

  if (!currentDraft) {
    images = await storeInlineImages(sourceImages, { label: '草稿图片' });
  } else {
    const originalImages = getDraftImages(currentDraft);
    const currentDto = await toDraftDto(currentDraft);
    const originalByUrl = new Map(currentDto.images.map((url, index) => [url, originalImages[index]]));
    const trustedImages = sourceImages.map((image) => {
      if (image === '' || image === undefined || image === null) return image;
      if (typeof image === 'string' && /^data:image\//i.test(image)) return image;
      if (originalByUrl.has(image)) return originalByUrl.get(image);
      throw new AppError('草稿图片无效或已过期', 400, 'INVALID_IMAGE');
    });
    images = await storeTrustedImages(trustedImages, { label: '草稿图片' });
  }

  return {
    title: data.title?.trim() || '',
    content: data.content?.trim() || '',
    moodType: data.moodType || null,
    mood: data.mood || '平静',
    tags: Array.isArray(data.tags)
      ? data.tags.map((tag) => tag?.trim()).filter(Boolean)
      : [],
    images,
  };
};

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
  const payload = await normalizeDraftData(data);
  assertDraftContent(payload);

  const draft = await Draft.create({ ownerUserId: userId, ...payload });
  return toDraftDto(draft.toObject());
};

export const getDrafts = async (userId) => {
  const drafts = await Draft.find({ ownerUserId: userId })
    .select('title content tags updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  return drafts.map((draft) => ({
    id: draft._id.toString(),
    title: draft.title,
    content: draft.content,
    tags: draft.tags,
    updatedAt: draft.updatedAt,
  }));
};

export const getDraftById = async (draftId, userId) => {
  const draft = await Draft.findOne({ _id: draftId, ownerUserId: userId }).lean();
  if (!draft) throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');
  return toDraftDto(draft);
};

export const updateDraft = async (draftId, userId, data) => {
  const currentDraft = await Draft.findOne({ _id: draftId, ownerUserId: userId }).lean();
  if (!currentDraft) throw new AppError('草稿不存在', 404, 'DRAFT_NOT_FOUND');

  const payload = await normalizeDraftData(data, currentDraft);
  assertDraftContent(payload);

  const draft = await Draft.findOneAndUpdate(
    { _id: draftId, ownerUserId: userId },
    { $set: { ...payload, updatedAt: new Date() }, $unset: { image: '' } },
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
  const images = await storeTrustedImages(getDraftImages(draft), { label: '草稿图片' });
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

  try {
    broadcast('new-post', {});
  } catch (error) {
    console.error('SSE broadcast failed after draft publication:', error);
  }

  await Draft.deleteOne({ _id: draftId });

  return serializePostMedia({
    ...post.toObject(),
    image: images[0] || '',
    images,
    id: post._id.toString(),
    time: formatRelativeTime(post.createdAt),
    isLiked: false,
  });
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
