import * as draftService from '../services/draftService.js';

export const create = async (req, res) => {
  const draft = await draftService.createDraft(req.user._id.toString(), req.body);
  res.status(201).json(draft);
};

export const list = async (req, res) => {
  const drafts = await draftService.getDrafts(req.user._id.toString());
  res.json(drafts);
};

export const getById = async (req, res) => {
  const draft = await draftService.getDraftById(req.params.id, req.user._id.toString());
  res.json(draft);
};

export const update = async (req, res) => {
  const draft = await draftService.updateDraft(req.params.id, req.user._id.toString(), req.body);
  res.json(draft);
};

export const remove = async (req, res) => {
  await draftService.deleteDraft(req.params.id, req.user._id.toString());
  res.json({ message: '已删除' });
};

export const removeMany = async (req, res) => {
  const { ids } = req.body;
  await draftService.deleteDrafts(ids, req.user._id.toString());
  res.json({ message: '已删除' });
};

export const publish = async (req, res) => {
  const post = await draftService.publishDraft(req.params.id, req.user._id.toString());
  res.status(201).json(post);
};