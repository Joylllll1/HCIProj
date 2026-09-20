import * as likeService from '../services/likeService.js';

export const list = async (req, res) => {
  const userId = req.user._id.toString();
  const result = await likeService.getUserLikes(userId);
  res.json(result);
};
