import { createHash } from 'node:crypto';

const MEDIA_ROUTE_SEGMENTS = new Set(['posts', 'drafts', 'comments', 'replies', 'events']);

function idOf(value) {
  const id = value?._id ?? value?.id;
  return id === undefined || id === null ? '' : String(id);
}

function hasMediaUrl(value) {
  return typeof value === 'string' && value.startsWith('/api/media/');
}

function imageVersion(kind, id, key, image) {
  const stored = image.match(/^file:([a-f\d]{64})\.([a-z0-9.+-]+)$/i);
  const inline = image.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  const contentType = stored ? `image/${stored[2].toLowerCase()}` : inline?.[1].toLowerCase() || '';
  const digest = stored?.[1].toLowerCase() || createHash('sha256')
    .update(inline ? Buffer.from(inline[2], 'base64') : image)
    .digest('hex');
  return createHash('sha256')
    .update(`${kind}\0${id}\0${key ?? ''}\0${contentType}\0${digest}`)
    .digest('hex');
}

export function mediaUrl(kind, id, key, image) {
  if (typeof image !== 'string' || !image) return '';
  if (hasMediaUrl(image)) return image;

  const resourceId = id === undefined || id === null ? '' : String(id);
  if (!MEDIA_ROUTE_SEGMENTS.has(kind) || !resourceId) return '';

  let route = `/api/media/${kind}/${encodeURIComponent(resourceId)}`;
  if (kind === 'posts' || kind === 'drafts' || kind === 'replies') {
    if (key === undefined || key === null || String(key) === '') return '';
    route += `/${encodeURIComponent(String(key))}`;
  }

  const version = imageVersion(kind, resourceId, key, image);
  return `${route}?v=${version}`;
}

function imagesOf(value) {
  if (Array.isArray(value?.images) && value.images.length > 0) return value.images;
  return value?.image ? [value.image] : [];
}

export function serializePostMedia(post) {
  if (!post || typeof post !== 'object') return post;
  const id = idOf(post);
  const images = imagesOf(post).map((image, index) => mediaUrl('posts', id, index, image));
  return {
    ...post,
    image: images[0] || '',
    images,
  };
}

export function serializeDraftMedia(draft) {
  if (!draft || typeof draft !== 'object') return draft;
  const id = idOf(draft);
  const images = imagesOf(draft).map((image, index) => mediaUrl('drafts', id, index, image));
  return {
    ...draft,
    image: images[0] || '',
    images,
  };
}

export function serializeCommentMedia(comment) {
  if (!comment || typeof comment !== 'object') return comment;
  const id = idOf(comment);
  const replies = Array.isArray(comment.replies)
    ? comment.replies.map((reply) => ({
      ...reply,
      image: mediaUrl('replies', id, idOf(reply), reply?.image),
    }))
    : comment.replies;

  return {
    ...comment,
    image: mediaUrl('comments', id, 'image', comment.image),
    ...(Array.isArray(comment.replies) ? { replies } : {}),
  };
}

export function serializeEventMedia(event) {
  if (!event || typeof event !== 'object') return event;
  const id = idOf(event);
  return {
    ...event,
    image: mediaUrl('events', id, 'image', event.image),
  };
}
