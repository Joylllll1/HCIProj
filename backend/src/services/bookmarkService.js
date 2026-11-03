import User from '../models/User.js';
import Post from '../models/Post.js';
import AppError from '../utils/AppError.js';
import mongoose from 'mongoose';
import { broadcast } from './sseManager.js';

const DEFAULT_FOLDER = { id: 'all', name: '全部', isDefault: true };

function broadcastPostStats(post) {
  try {
    broadcast('post-stats-updated', {
      postId: post._id.toString(),
      likes: Math.max(0, post.likes || 0),
      saves: Math.max(0, post.saves || 0),
    });
  } catch (error) {
    console.error('SSE broadcast failed after bookmark update:', error);
  }
}

function createFolderId() {
  return `folder-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFolderName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function filterValidPostIds(values = []) {
  return values.filter((value) => mongoose.Types.ObjectId.isValid(value));
}

function sanitizeFolders(rawFolders = []) {
  const folders = [];
  const seenIds = new Set([DEFAULT_FOLDER.id]);

  for (const folder of rawFolders) {
    if (!folder || typeof folder !== 'object') continue;
    if (folder.id === DEFAULT_FOLDER.id) continue;

    const id = typeof folder.id === 'string' && folder.id.trim() ? folder.id.trim() : createFolderId();
    if (seenIds.has(id)) continue;

    const name = normalizeFolderName(folder.name);
    if (!name) continue;

    seenIds.add(id);
    folders.push({
      id,
      name,
      isDefault: false,
    });
  }

  return [DEFAULT_FOLDER, ...folders];
}

function mapToObject(mapValue) {
  if (!mapValue) return {};

  if (mapValue instanceof Map) {
    return Object.fromEntries(mapValue.entries());
  }

  if (typeof mapValue === 'object') {
    return { ...mapValue };
  }

  return {};
}

function sanitizeFolderMap(rawFolderMap, folders, savedPostIds) {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const validSavedIds = new Set(savedPostIds);
  const source = mapToObject(rawFolderMap);
  const nextMap = {};
  const assigned = new Set();

  for (const [folderId, postIds] of Object.entries(source)) {
    if (folderId === DEFAULT_FOLDER.id || !folderIds.has(folderId)) continue;

    const ids = uniqueStrings(Array.isArray(postIds) ? postIds : []).filter((postId) => validSavedIds.has(postId) && !assigned.has(postId));
    ids.forEach((id) => assigned.add(id));
    if (ids.length > 0) {
      nextMap[folderId] = ids;
    }
  }

  return nextMap;
}

function mergeFolderDefinitions(existingFolders, incomingFolders) {
  const mergedById = new Map();

  for (const folder of existingFolders) {
    if (!folder || folder.id === DEFAULT_FOLDER.id) continue;
    mergedById.set(folder.id, {
      id: folder.id,
      name: folder.name,
      isDefault: false,
    });
  }

  for (const folder of incomingFolders) {
    if (!folder || folder.id === DEFAULT_FOLDER.id) continue;
    mergedById.set(folder.id, {
      id: folder.id,
      name: folder.name,
      isDefault: false,
    });
  }

  return sanitizeFolders(Array.from(mergedById.values()));
}

function mergeFolderMaps(existingMap, incomingMap) {
  const merged = {};
  const sourceMaps = [mapToObject(existingMap), mapToObject(incomingMap)];

  for (const source of sourceMaps) {
    for (const [folderId, postIds] of Object.entries(source)) {
      merged[folderId] = [...new Set([...(merged[folderId] || []), ...(Array.isArray(postIds) ? postIds : [])])];
    }
  }

  return merged;
}

async function getSavedPostIds(userId) {
  const posts = await Post.find({ isDeleted: false, savedBy: userId }).select('_id').lean();
  return posts.map((post) => post._id.toString());
}

// All bookmark writers share this queue in the single Node deployment.
const userQueues = new Map();
export async function withBookmarkLock(userId, task) {
  const key = userId.toString();
  const previous = userQueues.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  userQueues.set(key, current);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (userQueues.get(key) === current) userQueues.delete(key);
  }
}

async function readState(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
  const bookmarks = await getSavedPostIds(userId);
  const collectionFolders = sanitizeFolders(user.bookmarkFolders || []);
  return { user, bookmarks, collectionFolders,
    bookmarkFolders: sanitizeFolderMap(user.bookmarkFolderMap, collectionFolders, bookmarks),
    version: user.bookmarkVersion ?? 0 };
}

function buildBookmarkStateResult(state) {
  return { bookmarks: state.bookmarks, collectionFolders: state.collectionFolders,
    bookmarkFolders: state.bookmarkFolders, version: state.version };
}

function checkVersion(state, expectedVersion) {
  if (!Number.isInteger(state.user.bookmarkVersion)) {
    throw new AppError('收藏数据需要版本回填，请先运行回填脚本', 503, 'BOOKMARK_MIGRATION_REQUIRED');
  }
  if (expectedVersion !== undefined && state.version !== expectedVersion) {
    throw new AppError('收藏已更新，请刷新后重试', 409, 'BOOKMARK_VERSION_CONFLICT');
  }
}

async function persistState(userId, state) {
  const result = await User.updateOne(
    { _id: userId, bookmarkVersion: state.version },
    { $set: { bookmarkFolders: state.collectionFolders, bookmarkFolderMap: state.bookmarkFolders },
      $inc: { bookmarkVersion: 1 } },
  );
  if (result.matchedCount !== 1) throw new AppError('收藏已更新，请刷新后重试', 409, 'BOOKMARK_VERSION_CONFLICT');
  state.version += 1;
  return buildBookmarkStateResult(state);
}

async function mutate(userId, task, expectedVersion) {
  return withBookmarkLock(userId, async () => {
    const state = await readState(userId);
    checkVersion(state, expectedVersion);
    return task(state);
  });
}

function assignBookmarkToFolder(folderMap, folderId, postId) {
  const nextMap = {};

  for (const [currentFolderId, ids] of Object.entries(folderMap)) {
    const filtered = ids.filter((id) => id !== postId);
    if (filtered.length > 0) {
      nextMap[currentFolderId] = filtered;
    }
  }

  if (folderId && folderId !== DEFAULT_FOLDER.id) {
    nextMap[folderId] = [...new Set([...(nextMap[folderId] || []), postId])];
  }

  return nextMap;
}

export async function getBookmarkState(userId) {
  // Normalize responses without persisting a stale read snapshot.
  return withBookmarkLock(userId, async () => buildBookmarkStateResult(await readState(userId)));
}

export async function createBookmarkFolder(userId, name) {
  const normalizedName = normalizeFolderName(name);
  if (!normalizedName) throw new AppError('文件夹名称不能为空', 400, 'BOOKMARK_FOLDER_NAME_REQUIRED');
  return mutate(userId, async (state) => {
    state.collectionFolders.push({ id: createFolderId(), name: normalizedName, isDefault: false });
    return persistState(userId, state);
  });
}

function requireFolder(state, folderId) {
  if (!state.collectionFolders.some((folder) => folder.id === folderId)) {
    throw new AppError('文件夹不存在', 404, 'BOOKMARK_FOLDER_NOT_FOUND');
  }
}

export async function renameBookmarkFolder(userId, folderId, name) {
  if (!folderId || folderId === 'all') throw new AppError('默认文件夹不支持重命名', 400, 'BOOKMARK_FOLDER_RENAME_FORBIDDEN');
  const normalizedName = normalizeFolderName(name);
  if (!normalizedName) throw new AppError('文件夹名称不能为空', 400, 'BOOKMARK_FOLDER_NAME_REQUIRED');
  return mutate(userId, async (state) => {
    requireFolder(state, folderId);
    state.collectionFolders = state.collectionFolders.map((folder) =>
      folder.id === folderId ? { ...folder, name: normalizedName } : folder);
    return persistState(userId, state);
  });
}

export async function deleteBookmarkFolder(userId, folderId) {
  if (!folderId || folderId === 'all') throw new AppError('默认文件夹不支持删除', 400, 'BOOKMARK_FOLDER_DELETE_FORBIDDEN');
  return mutate(userId, async (state) => {
    requireFolder(state, folderId);
    state.collectionFolders = state.collectionFolders.filter((folder) => folder.id !== folderId);
    delete state.bookmarkFolders[folderId];
    return persistState(userId, state);
  });
}

async function setPostSaved(userId, postId, saved) {
  const post = await Post.findOneAndUpdate(
    { _id: postId, isDeleted: false, savedBy: saved ? { $ne: userId } : userId },
    saved ? { $addToSet: { savedBy: userId }, $inc: { saves: 1 } }
      : [{ $set: { savedBy: { $filter: { input: '$savedBy', as: 'owner', cond: { $ne: ['$$owner', new mongoose.Types.ObjectId(userId)] } } },
        saves: { $max: [0, { $subtract: [{ $ifNull: ['$saves', 0] }, 1] }] } } }],
    { new: true },
  ).lean();
  if (post) broadcastPostStats(post);
  return post;
}

async function saveInState(userId, postId, folderId, state) {
  requireFolder(state, folderId);
  const post = await setPostSaved(userId, postId, true)
    || await Post.findOne({ _id: postId, isDeleted: false }).lean();
  if (!post) throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  state.bookmarks = [...new Set([...state.bookmarks, postId])];
  state.bookmarkFolders = assignBookmarkToFolder(state.bookmarkFolders, folderId, postId);
  try { return { saved: true, saves: post.saves || 0, ...await persistState(userId, state) }; }
  catch { throw new AppError('收藏已保存，分类同步待恢复，请刷新后重试', 503, 'BOOKMARK_RECONCILING'); }
}

export async function saveBookmark(userId, postId, folderId = 'all') {
  return mutate(userId, (state) => saveInState(userId, postId, folderId, state));
}

export async function removeBookmark(userId, postId) {
  return mutate(userId, async (state) => {
    const data = await removeInState(userId, [postId], state);
    if (data.results[0].status === 'not_found') throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
    if (data.results[0].status === 'failed') throw new AppError('取消收藏失败，请刷新后重试', 503, 'BOOKMARK_RECONCILING');
    return { saved: false, saves: data.postStates[0]?.saves || 0, ...data };
  });
}

export async function toggleBookmark(userId, postId) {
  return mutate(userId, async (state) => {
    if (state.bookmarks.includes(postId)) {
      const data = await removeInState(userId, [postId], state);
      if (data.results[0].status === 'failed') throw new AppError('取消收藏失败，请刷新后重试', 503, 'BOOKMARK_RECONCILING');
      return { saved: false, saves: data.postStates[0]?.saves || 0, ...data };
    }
    return saveInState(userId, postId, 'all', state);
  });
}

export function validateBatch(payload, moving = false) {
  const allowed = moving ? ['postIds', 'targetFolderId', 'expectedVersion'] : ['postIds', 'expectedVersion'];
  if (!payload || Object.keys(payload).some((key) => !allowed.includes(key))
    || !Array.isArray(payload.postIds) || payload.postIds.length < 1 || payload.postIds.length > 100
    || payload.postIds.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))
    || !Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 0
    || (moving && (typeof payload.targetFolderId !== 'string' || !payload.targetFolderId.trim()))) {
    throw new AppError('请选择 1–100 篇收藏并提供有效版本和目标', 400, 'BOOKMARK_BATCH_INVALID');
  }
  return [...new Set(payload.postIds.map((id) => id.toLowerCase()))];
}

function batchResult(state, results, postStates = [], reconciling = false) {
  return { ...buildBookmarkStateResult(state), results, postStates, reconciling,
    summary: { requested: results.length,
      changed: results.filter((item) => ['moved', 'removed'].includes(item.status)).length,
      unchanged: results.filter((item) => item.status === 'unchanged').length,
      failed: results.filter((item) => item.status === 'failed').length } };
}

export async function moveBookmarks(userId, payload) {
  const ids = validateBatch(payload, true);
  return mutate(userId, async (state) => {
    requireFolder(state, payload.targetFolderId);
    const posts = await Post.find({ _id: { $in: ids }, isDeleted: false }).select('_id').lean();
    const existing = new Set(posts.map((post) => post._id.toString()));
    const results = ids.map((postId) => {
      if (!existing.has(postId)) return { postId, status: 'not_found' };
      if (!state.bookmarks.includes(postId)) return { postId, status: 'not_saved' };
      const fromFolderId = Object.keys(state.bookmarkFolders).find((key) => state.bookmarkFolders[key].includes(postId)) || 'all';
      state.bookmarkFolders = assignBookmarkToFolder(state.bookmarkFolders, payload.targetFolderId, postId);
      return { postId, status: fromFolderId === payload.targetFolderId ? 'unchanged' : 'moved',
        fromFolderId, toFolderId: payload.targetFolderId };
    });
    if (results.some((item) => item.status === 'moved')) await persistState(userId, state);
    return batchResult(state, results);
  }, payload.expectedVersion);
}

async function removeInState(userId, ids, state) {
  const results = [];
  const postStates = [];
  for (const postId of ids) {
    try {
      const changed = await setPostSaved(userId, postId, false);
      const post = changed || await Post.findOne({ _id: postId, isDeleted: false }).lean();
      results.push({ postId, status: changed ? 'removed' : post ? 'unchanged' : 'not_found' });
      if (post) postStates.push({ postId, isSaved: false, saves: Math.max(0, post.saves || 0) });
    } catch {
      // A failed acknowledgement may follow a committed write. Verify the fact
      // before reporting failure, and return the observed count to every page.
      const observed = await Post.findOne({ _id: postId, isDeleted: false }).lean().catch(() => null);
      if (observed && !observed.savedBy.some((id) => id.toString() === userId)) {
        results.push({ postId, status: state.bookmarks.includes(postId) ? 'removed' : 'unchanged' });
        postStates.push({ postId, isSaved: false, saves: Math.max(0, observed.saves || 0) });
        broadcastPostStats(observed);
      } else {
        results.push({ postId, status: 'failed', error: '取消失败，请重试' });
      }
    }
  }
  let reconciling = false;
  try {
    // Re-read savedBy facts before cleaning maps, including lost acknowledgements.
    state.bookmarks = await getSavedPostIds(userId);
    state.bookmarkFolders = sanitizeFolderMap(state.bookmarkFolders, state.collectionFolders, state.bookmarks);
    await persistState(userId, state);
  } catch {
    reconciling = true;
    const fresh = await readState(userId).catch(() => null);
    if (!fresh) throw new AppError('部分取消可能已完成，请刷新核对后重试', 503, 'BOOKMARK_RECONCILING');
    Object.assign(state, fresh);
  }
  return batchResult(state, results, postStates, reconciling);
}

export async function removeBookmarks(userId, payload) {
  const ids = validateBatch(payload);
  return mutate(userId, (state) => removeInState(userId, ids, state), payload.expectedVersion);
}

export async function migrateLegacyBookmarks(userId, payload = {}) {
  return mutate(userId, async (state) => {
    const ids = filterValidPostIds(uniqueStrings(Array.isArray(payload.bookmarks) ? payload.bookmarks : []));
    const posts = await Post.find({ _id: { $in: ids }, isDeleted: false }).select('_id').lean();
    for (const post of posts) await setPostSaved(userId, post._id.toString(), true);
    state.bookmarks = await getSavedPostIds(userId);
    state.collectionFolders = mergeFolderDefinitions(state.collectionFolders,
      sanitizeFolders(Array.isArray(payload.collectionFolders) ? payload.collectionFolders : []));
    state.bookmarkFolders = sanitizeFolderMap(mergeFolderMaps(state.bookmarkFolders, payload.bookmarkFolders),
      state.collectionFolders, state.bookmarks);
    try { return await persistState(userId, state); }
    catch { throw new AppError('收藏已迁移，分类同步待恢复，请刷新后重试', 503, 'BOOKMARK_RECONCILING'); }
  });
}
