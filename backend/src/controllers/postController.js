import * as postService from '../services/postService.js';

export const create = async (req, res) => {
  const post = await postService.createPost(req.user._id.toString(), req.body);
  res.status(201).json(post);
};

export const list = async (req, res) => {
  const { page = 1, limit = 20, query, sort = 'latest' } = req.query;
  const userId = req.user?._id?.toString();
  const result = await postService.getPosts({ page: +page, limit: +limit, query, sort, userId });
  res.json(result);
};

export const getById = async (req, res) => {
  const userId = req.user?._id?.toString();
  const post = await postService.getPostById(req.params.id, userId);
  res.json(post);
};

export const remove = async (req, res) => {
  await postService.deletePost(req.user._id.toString(), req.params.id);
  res.json({ message: '已删除' });
};

export const like = async (req, res) => {
  const result = await postService.toggleLike(req.user._id.toString(), req.params.id);
  res.json(result);
};

export const save = async (req, res) => {
  const result = await postService.toggleSave(req.user._id.toString(), req.params.id);
  res.json(result);
};

export const getSaved = async (req, res) => {
  const userId = req.user._id.toString();
  const posts = await postService.getSavedPosts(userId);
  res.json(posts);
};

export const mine = async (req, res) => {
  const posts = await postService.getMyPosts(req.user._id.toString());
  res.json(posts);
};
