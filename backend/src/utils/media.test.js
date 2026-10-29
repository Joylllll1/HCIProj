import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mediaUrl,
  serializeCommentMedia,
  serializeDraftMedia,
  serializeEventMedia,
  serializePostMedia,
} from './media.js';

test('image URL versions stay stable when identical legacy bytes move to file storage', () => {
  const bytes = Buffer.from('same image bytes');
  const inline = `data:image/png;base64,${bytes.toString('base64')}`;
  const stored = `file:${createHash('sha256').update(bytes).digest('hex')}.png`;
  assert.equal(mediaUrl('drafts', 'draft-id', 0, inline), mediaUrl('drafts', 'draft-id', 0, stored));
  assert.notEqual(mediaUrl('drafts', 'draft-id', 0, stored), mediaUrl('drafts', 'draft-id', 1, stored));
});

test('post and draft image URLs are resource and image version scoped', () => {
  const imageA = 'file:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
  const imageB = 'file:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png';
  const post = { _id: 'post-id', title: '标题', images: [imageA, imageB], image: imageA };
  const serializedPost = serializePostMedia(post);
  const serializedDraft = serializeDraftMedia({ _id: 'draft-id', images: [imageA] });

  assert.equal(serializedPost.title, '标题');
  assert.equal(serializedPost.images.length, 2);
  assert.equal(serializedPost.image, serializedPost.images[0]);
  assert.match(serializedPost.images[0], /^\/api\/media\/posts\/post-id\/0\?v=[a-f\d]{64}$/);
  assert.notEqual(serializedPost.images[0], serializedPost.images[1]);
  assert.match(serializedDraft.images[0], /^\/api\/media\/drafts\/draft-id\/0\?v=/);
  assert.notEqual(serializedDraft.images[0], serializedPost.images[0]);
  assert.equal(mediaUrl('posts', 'post-id', 0, imageA), serializedPost.images[0]);
  assert.notEqual(mediaUrl('posts', 'post-id', 0, imageB), serializedPost.images[0]);
});

test('comment replies and event posters retain non-image fields while using media routes', () => {
  const comment = serializeCommentMedia({
    _id: '507f1f77bcf86cd799439011',
    content: '评论',
    image: 'data:image/png;base64,AA==',
    replies: [{ _id: '507f1f77bcf86cd799439012', content: '回复', image: 'data:image/gif;base64,AQ==' }],
  });
  const event = serializeEventMedia({ _id: '507f1f77bcf86cd799439013', title: '活动', image: 'data:image/png;base64,AA==' });

  assert.equal(comment.content, '评论');
  assert.match(comment.image, /^\/api\/media\/comments\/507f1f77bcf86cd799439011\?v=/);
  assert.match(comment.replies[0].image, /^\/api\/media\/replies\/507f1f77bcf86cd799439011\/507f1f77bcf86cd799439012\?v=/);
  assert.equal(comment.replies[0].content, '回复');
  assert.match(event.image, /^\/api\/media\/events\/507f1f77bcf86cd799439013\?v=/);
  assert.equal(event.title, '活动');
});
