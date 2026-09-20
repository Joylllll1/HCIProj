import * as fortuneService from '../services/fortuneService.js';

export const checkin = async (req, res) => {
  const userId = req.user._id.toString();
  const result = await fortuneService.checkin(userId);
  res.json(result);
};

export const status = async (req, res) => {
  const userId = req.user._id.toString();
  const result = await fortuneService.getStatus(userId);
  res.json(result);
};
