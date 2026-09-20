import { schema as webSearchSchema, handler as webSearchHandler } from './webSearch.js';
import { schema as fetchUrlSchema, handler as fetchUrlHandler } from './fetchUrl.js';
import { schema as searchPostsSchema, handler as searchPostsHandler } from './searchPosts.js';
import { schema as getPostSchema, handler as getPostHandler } from './getPost.js';
import { schema as getHotTopicsSchema, handler as getHotTopicsHandler } from './getHotTopics.js';

export const toolSchemas = [webSearchSchema, fetchUrlSchema, searchPostsSchema, getPostSchema, getHotTopicsSchema];

const handlerMap = {
  web_search: webSearchHandler, fetch_url: fetchUrlHandler, search_posts: searchPostsHandler,
  get_post: getPostHandler, get_hot_topics: getHotTopicsHandler,
};

export async function executeTool(name, args, signal) {
  const fn = handlerMap[name];
  if (!fn) return { error: `未知工具: ${name}` };
  return fn(args, signal);
}
