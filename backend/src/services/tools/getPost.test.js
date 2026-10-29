import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import Post from '../../models/Post.js';
import Comment from '../../models/Comment.js';
import { handler } from './getPost.js';

afterEach(() => mock.restoreAll());

test('get_post queries visible comments by postId and returns them chronologically', async () => {
  const postId = '507f1f77bcf86cd799439011';
  const createdAt = [new Date('2026-01-02T00:00:00Z'), new Date('2026-01-01T00:00:00Z')];
  const comments = [
    { content: 'newer', createdAt: createdAt[0] },
    { content: 'older', createdAt: createdAt[1] },
  ];
  let commentFilter;
  let sortOrder;
  const limits = [];

  mock.method(Post, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: { toString: () => postId },
        title: '帖子标题',
        content: '帖子正文',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: ['校园生活'],
        likes: 2,
      }),
    }),
  }));
  mock.method(Comment, 'find', (filter) => {
    commentFilter = filter;
    return {
      sort: (value) => {
        sortOrder = value;
        return {
          limit: (value2) => {
          limits.push(value2);
            return {
              select: () => ({ lean: async () => comments.map((comment) => ({ ...comment })) }),
            };
          },
        };
      },
    };
  });

  const result = await handler({ postId, commentLimit: 70 });
  await handler({ postId, commentLimit: 0 });
  await handler({ postId, commentLimit: 7 });

  assert.deepEqual(commentFilter, { postId, isDeleted: false });
  assert.deepEqual(sortOrder, { createdAt: -1 });
  assert.deepEqual(limits, [50, 1, 7]);
  assert.deepEqual(result.comments.map(({ content }) => content), ['older', 'newer']);
  assert.equal(result.totalComments, 2);
});
