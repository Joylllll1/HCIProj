import Post from '../../models/Post.js';

export const schema = {
  type: 'function',
  function: {
    name: 'get_hot_topics',
    description: '获取当前站内热门帖子。用户问"最近大家在讨论什么""树洞热点"时使用。',
    parameters: { type: 'object', properties: {} },
  },
};

export async function handler() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let posts = await Post.find({ isDeleted: false, createdAt: { $gte: oneDayAgo } })
    .sort({ likes: -1, comments: -1 }).limit(10)
    .select('title content createdAt likes tags').lean();

  if (posts.length < 5) {
    posts = await Post.find({ isDeleted: false })
      .sort({ createdAt: -1 }).limit(10)
      .select('title content createdAt likes tags').lean();
  }

  return {
    results: posts.map(p => ({
      postId: p._id.toString(), title: p.title || '',
      contentPreview: (p.content || '').slice(0, 100),
      likes: p.likes || 0, createdAt: p.createdAt, tags: p.tags || [],
    })),
  };
}
