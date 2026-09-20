import Post from '../../models/Post.js';
import Comment from '../../models/Comment.js';

export const schema = {
  type: 'function',
  function: {
    name: 'get_post',
    description: '获取指定帖子的详细内容和评论。用户要求总结某个帖子、分析评论区时使用。',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: '帖子 ID' },
        commentLimit: { type: 'number', description: '最多返回多少条评论，默认 20' },
      },
      required: ['postId'],
    },
  },
};

export async function handler({ postId, commentLimit = 20 }) {
  const post = await Post.findOne({ _id: postId, isDeleted: false })
    .select('title content createdAt tags likes').lean();
  if (!post) return { error: '帖子不存在' };

  const comments = await Comment.find({ post: postId, isDeleted: false })
    .sort({ createdAt: -1 }).limit(Math.min(commentLimit, 50))
    .select('content createdAt').lean();

  return {
    post: {
      postId: post._id.toString(), title: post.title || '', content: post.content || '',
      createdAt: post.createdAt, tags: post.tags || [], likes: post.likes || 0,
    },
    comments: comments.reverse().map(c => ({ content: c.content, createdAt: c.createdAt })),
    totalComments: comments.length,
  };
}
