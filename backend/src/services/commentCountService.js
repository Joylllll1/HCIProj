import Comment from '../models/Comment.js';
import Post from '../models/Post.js';

export async function getVisibleCommentCounts(postIds) {
  const normalizedPostIds = [...new Set((postIds || []).map((postId) => postId?.toString()).filter(Boolean))];
  if (normalizedPostIds.length === 0) {
    return new Map();
  }

  const rows = await Comment.aggregate([
    {
      $match: {
        postId: { $in: normalizedPostIds.map((postId) => Post.db.base.Types.ObjectId.createFromHexString(postId)) },
        isDeleted: false,
      },
    },
    {
      $project: {
        postId: 1,
        visibleCount: {
          $add: [
            1,
            {
              $size: {
                $filter: {
                  input: '$replies',
                  as: 'reply',
                  cond: { $ne: ['$$reply.isDeleted', true] },
                },
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$postId',
        count: { $sum: '$visibleCount' },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function getVisibleCommentCount(postId) {
  const counts = await getVisibleCommentCounts([postId]);
  return counts.get(postId.toString()) || 0;
}

export async function syncPostCommentCount(postId) {
  const count = await getVisibleCommentCount(postId);
  await Post.findByIdAndUpdate(postId, { comments: count });
  return count;
}
