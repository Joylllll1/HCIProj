import * as mediaService from '../services/mediaService.js';

const MEDIA_CONTENT_SECURITY_POLICY = "default-src 'none'; sandbox; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'";

function matchesIfNoneMatch(header, etag) {
  if (typeof header !== 'string' || !header.trim()) return false;
  return header.split(',').some((candidate) => {
    const token = candidate.trim();
    return token === '*' || token.replace(/^W\//i, '') === etag;
  });
}

function sendImage(req, res, media) {
  res.vary('Cookie');
  res.set({
    'Content-Type': media.contentType,
    'Content-Length': String(media.buffer.length),
    ETag: media.etag,
    'Cache-Control': 'private, max-age=300, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': MEDIA_CONTENT_SECURITY_POLICY,
  });

  if (matchesIfNoneMatch(req.get('If-None-Match'), media.etag)) {
    return res.status(304).end();
  }
  return res.status(200).send(media.buffer);
}

export async function getPostImage(req, res) {
  const media = await mediaService.getPostImage(req.params.id, req.params.index);
  return sendImage(req, res, media);
}

export async function getDraftImage(req, res) {
  const media = await mediaService.getDraftImage(req.params.id, req.params.index, req.user);
  return sendImage(req, res, media);
}

export async function getCommentImage(req, res) {
  const media = await mediaService.getCommentImage(req.params.id);
  return sendImage(req, res, media);
}

export async function getReplyImage(req, res) {
  const media = await mediaService.getReplyImage(req.params.commentId, req.params.replyId);
  return sendImage(req, res, media);
}

export async function getEventImage(req, res) {
  const media = await mediaService.getEventImage(req.params.id, req.user);
  return sendImage(req, res, media);
}
