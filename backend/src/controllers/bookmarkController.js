import * as bookmarkService from '../services/bookmarkService.js';

export async function getBookmarks(req, res) {
  const data = await bookmarkService.getBookmarkState(req.user._id.toString());
  res.json(data);
}

export async function migrateBookmarks(req, res) {
  const data = await bookmarkService.migrateLegacyBookmarks(req.user._id.toString(), req.body);
  res.json(data);
}

export async function createFolder(req, res) {
  const data = await bookmarkService.createBookmarkFolder(req.user._id.toString(), req.body?.name);
  res.status(201).json(data);
}

export async function renameFolder(req, res) {
  const data = await bookmarkService.renameBookmarkFolder(
    req.user._id.toString(),
    req.params.folderId,
    req.body?.name,
  );
  res.json(data);
}

export async function deleteFolder(req, res) {
  const data = await bookmarkService.deleteBookmarkFolder(req.user._id.toString(), req.params.folderId);
  res.json(data);
}

export async function saveBookmark(req, res) {
  const data = await bookmarkService.saveBookmark(
    req.user._id.toString(),
    req.params.postId,
    req.body?.folderId,
  );
  res.json(data);
}

export async function removeBookmark(req, res) {
  const data = await bookmarkService.removeBookmark(req.user._id.toString(), req.params.postId);
  res.json(data);
}
