import * as commentService from '../services/commentService.js';

export const create = async (req, res) => {
  const { postId, content, image, official } = req.body;
  const comment = await commentService.createComment(req.user._id.toString(), postId, content, image, official);
  res.status(201).json(comment);
};

export const reply = async (req, res) => {
  const { content, image, official, replyToId } = req.body;
  const reply = await commentService.addReply(
    req.user._id.toString(),
    req.params.commentId,
    content,
    image,
    official,
    replyToId
  );
  res.status(201).json(reply);
};

export const list = async (req, res) => {
  const userId = req.user?._id?.toString();
  const comments = await commentService.getComments(req.params.postId, userId);
  res.json(comments);
};

export const remove = async (req, res) => {
  const result = await commentService.deleteComment(req.user._id.toString(), req.params.commentId);
  res.json({ message: '已删除', ...result });
};

export const removeReply = async (req, res) => {
  const result = await commentService.deleteReply(req.user._id.toString(), req.params.commentId, req.params.replyId);
  res.json({ message: '已删除', ...result });
};

export const like = async (req, res) => {
  const result = await commentService.toggleLike(req.user._id.toString(), req.params.commentId);
  res.json(result);
};

export const likeReply = async (req, res) => {
  const result = await commentService.toggleReplyLike(req.user._id.toString(), req.params.commentId, req.params.replyId);
  res.json(result);
};
