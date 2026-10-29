import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import Post from '../models/Post.js';
import Draft from '../models/Draft.js';
import Comment from '../models/Comment.js';
import Event from '../models/Event.js';
import {
  getCommentImage,
  getDraftImage,
  getEventImage,
  getPostImage,
  getReplyImage,
} from './mediaService.js';

const postId = '507f1f77bcf86cd799439011';
const draftId = '507f1f77bcf86cd799439012';
const commentId = '507f1f77bcf86cd799439013';
const replyId = '507f1f77bcf86cd799439014';
const ownerId = '507f1f77bcf86cd799439015';

afterEach(() => mock.restoreAll());

function query(value) {
  return { lean: async () => value };
}

test('post image reads require a valid active post and use the requested image index', async () => {
  let filter;
  mock.method(Post, 'findOne', (value) => {
    filter = value;
    return query({ images: ['data:image/png;base64,AA==', 'data:image/gif;base64,AQ=='] });
  });

  const image = await getPostImage(postId, '1');
  assert.deepEqual(filter, { _id: postId, isDeleted: false });
  assert.equal(image.contentType, 'image/gif');
  assert.deepEqual(image.buffer, Buffer.from([1]));
  await assert.rejects(() => getPostImage(postId, '2'), { errorCode: 'IMAGE_NOT_FOUND' });
});

test('draft media lookup is constrained to the authenticated owner', async () => {
  let filter;
  let draft = { image: 'data:image/png;base64,AA==' };
  mock.method(Draft, 'findOne', (value) => {
    filter = value;
    return query(draft);
  });

  const image = await getDraftImage(draftId, '0', { _id: ownerId });
  assert.deepEqual(filter, { _id: draftId, ownerUserId: ownerId });
  assert.equal(image.contentType, 'image/png');

  draft = null;
  await assert.rejects(() => getDraftImage(draftId, '0', { _id: ownerId }), { errorCode: 'IMAGE_NOT_FOUND' });
  await assert.rejects(() => getDraftImage(draftId, '0', null), { errorCode: 'IMAGE_NOT_FOUND' });
});

test('comment and reply images require active comments, replies, and parent posts', async () => {
  const comment = {
    _id: commentId,
    postId,
    isDeleted: false,
    image: 'data:image/png;base64,AA==',
    replies: [{ _id: replyId, isDeleted: false, image: 'data:image/gif;base64,AQ==' }],
  };
  let commentFilter;
  mock.method(Comment, 'findOne', (value) => {
    commentFilter = value;
    return query(comment);
  });
  let postFilter;
  let post = { _id: postId, isDeleted: false };
  mock.method(Post, 'findOne', (value) => {
    postFilter = value;
    return query(post);
  });

  assert.equal((await getCommentImage(commentId)).contentType, 'image/png');
  const replyImage = await getReplyImage(commentId, replyId);
  assert.equal(replyImage.contentType, 'image/gif');
  assert.deepEqual(commentFilter, { _id: commentId, isDeleted: { $ne: true } });
  assert.deepEqual(postFilter, { _id: postId, isDeleted: false });

  post = null;
  await assert.rejects(() => getReplyImage(commentId, replyId), { errorCode: 'IMAGE_NOT_FOUND' });
});

test('pending event posters are private to the applicant and admin; approved posters are public', async () => {
  let event = {
    _id: draftId,
    submittedBy: ownerId,
    status: 'pending',
    image: 'data:image/png;base64,AA==',
  };
  mock.method(Event, 'findById', () => query(event));

  await assert.rejects(() => getEventImage(draftId, null), { errorCode: 'IMAGE_NOT_FOUND' });
  assert.equal((await getEventImage(draftId, { _id: ownerId })).contentType, 'image/png');
  assert.equal((await getEventImage(draftId, { role: 'admin' })).contentType, 'image/png');

  event = { ...event, status: 'approved' };
  assert.equal((await getEventImage(draftId, null)).contentType, 'image/png');
});
