import Post from '../models/Post.js';
import Draft from '../models/Draft.js';
import Comment from '../models/Comment.js';
import Event from '../models/Event.js';
import AppError from '../utils/AppError.js';
import { readImage } from './imageStorage.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function notFound() {
  return new AppError('图片不存在', 404, 'IMAGE_NOT_FOUND');
}

function validId(value) {
  return typeof value === 'string' && OBJECT_ID_RE.test(value);
}

function idString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'object') return String(value);
  if (value._id !== undefined && value._id !== null) return String(value._id);
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (typeof value.id === 'string') return value.id;
  if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
    return value.toString();
  }
  return '';
}

function userIdOf(user) {
  return user ? idString(user._id ?? user.id) : '';
}

function imagesOf(document) {
  if (Array.isArray(document?.images) && document.images.length > 0) return document.images;
  return document?.image ? [document.image] : [];
}

function imageAt(document, index) {
  const images = imagesOf(document);
  if (!Number.isSafeInteger(index) || index < 0 || index >= images.length) throw notFound();
  return images[index];
}

async function activePost(postId) {
  if (!validId(idString(postId))) throw notFound();
  const post = await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw notFound();
  return post;
}

async function findComment(commentId) {
  if (!validId(commentId)) throw notFound();
  const comment = await Comment.findOne({ _id: commentId, isDeleted: { $ne: true } }).lean();
  if (!comment) throw notFound();
  await activePost(comment.postId);
  return comment;
}

export async function getPostImage(postId, imageIndex) {
  if (!validId(postId)) throw notFound();
  const index = Number(imageIndex);
  if (!Number.isSafeInteger(index) || index < 0) throw notFound();

  const post = await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw notFound();
  return readImage(imageAt(post, index));
}

export async function getDraftImage(draftId, imageIndex, user) {
  const userId = userIdOf(user);
  if (!validId(draftId) || !validId(userId)) throw notFound();

  const draft = await Draft.findOne({ _id: draftId, ownerUserId: userId }).lean();
  if (!draft) throw notFound();
  const index = Number(imageIndex);
  if (!Number.isSafeInteger(index) || index < 0) throw notFound();
  return readImage(imageAt(draft, index));
}

export async function getCommentImage(commentId) {
  const comment = await findComment(commentId);
  return readImage(comment.image);
}

export async function getReplyImage(commentId, replyId) {
  if (!validId(replyId)) throw notFound();
  const comment = await findComment(commentId);
  const normalizedReplyId = replyId.toLowerCase();
  const reply = (comment.replies || []).find((item) => (
    idString(item?._id ?? item?.id).toLowerCase() === normalizedReplyId
  ));
  if (!reply || reply.isDeleted) throw notFound();
  return readImage(reply.image);
}

export async function getEventImage(eventId, user) {
  if (!validId(eventId)) throw notFound();
  const event = await Event.findById(eventId).lean();
  if (!event) throw notFound();

  const isPublic = event.status === 'approved' || event.status === 'archived';
  const isOwner = userIdOf(user) && userIdOf(user) === idString(event.submittedBy);
  const isAdmin = user?.role === 'admin';
  if (!isPublic && !isOwner && !isAdmin) throw notFound();

  return readImage(event.image);
}
