import Post from '../../models/Post.js';

export const schema = {
  type: 'function',
  function: {
    name: 'search_posts',
    description: '搜索站内帖子。用户问站内有没有人讨论某个话题时使用。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索关键词' } },
      required: ['query'],
    },
  },
};

export async function handler({ query }) {
  const posts = await Post.find(
    { isDeleted: false, $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(5).select('title content createdAt tags').lean();

  return {
    results: posts.map(p => ({
      postId: p._id.toString(),
      title: p.title || '',
      contentPreview: (p.content || '').slice(0, 100),
      createdAt: p.createdAt,
      tags: p.tags || [],
    })),
  };
}
