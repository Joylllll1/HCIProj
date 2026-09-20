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

  for (const [folderId, postIds] of Object.entries(source)) {
    if (folderId === DEFAULT_FOLDER.id || !folderIds.has(folderId)) continue;

    const ids = uniqueStrings(Array.isArray(postIds) ? postIds : []).filter((postId) => validSavedIds.has(postId));
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

async function loadUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
  }
  return user;
}

async function normalizeAndPersist(user) {
  const savedPostIds = await getSavedPostIds(user._id.toString());
  const folders = sanitizeFolders(user.bookmarkFolders || []);
  const folderMap = sanitizeFolderMap(user.bookmarkFolderMap, folders, savedPostIds);

  const foldersChanged = JSON.stringify(user.bookmarkFolders || []) !== JSON.stringify(folders);
  const mapChanged = JSON.stringify(mapToObject(user.bookmarkFolderMap)) !== JSON.stringify(folderMap);

  if (foldersChanged || mapChanged) {
    user.bookmarkFolders = folders;
    user.bookmarkFolderMap = folderMap;
    await user.save();
  }

  return {
    user,
    bookmarks: savedPostIds,
    collectionFolders: folders,
    bookmarkFolders: folderMap,
  };
}

function buildBookmarkStateResult(state) {
  return {
    bookmarks: state.bookmarks,
    collectionFolders: state.collectionFolders,
    bookmarkFolders: state.bookmarkFolders,
  };
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
  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);
  return buildBookmarkStateResult(state);
}

export async function createBookmarkFolder(userId, name) {
  const normalizedName = normalizeFolderName(name);
  if (!normalizedName) {
    throw new AppError('文件夹名称不能为空', 400, 'BOOKMARK_FOLDER_NAME_REQUIRED');
  }

  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  user.bookmarkFolders = [
    ...state.collectionFolders,
    { id: createFolderId(), name: normalizedName, isDefault: false },
  ];
  await user.save();

  return getBookmarkState(userId);
}

export async function renameBookmarkFolder(userId, folderId, name) {
  if (!folderId || folderId === DEFAULT_FOLDER.id) {
    throw new AppError('默认文件夹不支持重命名', 400, 'BOOKMARK_FOLDER_RENAME_FORBIDDEN');
  }

  const normalizedName = normalizeFolderName(name);
  if (!normalizedName) {
    throw new AppError('文件夹名称不能为空', 400, 'BOOKMARK_FOLDER_NAME_REQUIRED');
  }

  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  const targetFolder = state.collectionFolders.find((folder) => folder.id === folderId);
  if (!targetFolder) {
    throw new AppError('文件夹不存在', 404, 'BOOKMARK_FOLDER_NOT_FOUND');
  }

  user.bookmarkFolders = state.collectionFolders.map((folder) =>
    folder.id === folderId ? { ...folder, name: normalizedName } : folder,
  );
  await user.save();

  return getBookmarkState(userId);
}

export async function deleteBookmarkFolder(userId, folderId) {
  if (!folderId || folderId === DEFAULT_FOLDER.id) {
    throw new AppError('默认文件夹不支持删除', 400, 'BOOKMARK_FOLDER_DELETE_FORBIDDEN');
  }

  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  const targetFolder = state.collectionFolders.find((folder) => folder.id === folderId);
  if (!targetFolder) {
    throw new AppError('文件夹不存在', 404, 'BOOKMARK_FOLDER_NOT_FOUND');
  }

  user.bookmarkFolders = state.collectionFolders.filter((folder) => folder.id !== folderId);
  const nextMap = { ...state.bookmarkFolders };
  delete nextMap[folderId];
  user.bookmarkFolderMap = nextMap;
  await user.save();

  return getBookmarkState(userId);
}

export async function saveBookmark(userId, postId, folderId = DEFAULT_FOLDER.id) {
  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  if (!state.collectionFolders.some((folder) => folder.id === folderId)) {
    throw new AppError('文件夹不存在', 404, 'BOOKMARK_FOLDER_NOT_FOUND');
  }

  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) {
    throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  }

  const alreadySaved = post.savedBy.some((id) => id.toString() === userId);
  if (!alreadySaved) {
    post.savedBy.push(userId);
    post.saves = (post.saves || 0) + 1;
    await post.save();
    broadcastPostStats(post);
  }

  user.bookmarkFolderMap = assignBookmarkToFolder(state.bookmarkFolders, folderId, postId);
  await user.save();

  const nextState = await getBookmarkState(userId);
  return {
    saved: true,
    saves: post.saves || 0,
    ...nextState,
  };
}

export async function removeBookmark(userId, postId) {
  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) {
    throw new AppError('帖子不存在', 404, 'POST_NOT_FOUND');
  }

  const savedBy = post.savedBy.map((id) => id.toString());
  const wasSaved = savedBy.includes(userId);

  if (wasSaved) {
    post.savedBy = post.savedBy.filter((id) => id.toString() !== userId);
    post.saves = Math.max(0, (post.saves || 0) - 1);
    await post.save();
    broadcastPostStats(post);
  }

  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  user.bookmarkFolderMap = assignBookmarkToFolder(state.bookmarkFolders, DEFAULT_FOLDER.id, postId);
  await user.save();

  const nextState = await getBookmarkState(userId);
  return {
    saved: false,
    saves: post.saves || 0,
    ...nextState,
  };
}

export async function migrateLegacyBookmarks(userId, payload = {}) {
  const incomingBookmarks = filterValidPostIds(
    uniqueStrings(Array.isArray(payload.bookmarks) ? payload.bookmarks : []),
  );
  const incomingFolders = sanitizeFolders(Array.isArray(payload.collectionFolders) ? payload.collectionFolders : []);
  const incomingFolderMap = mapToObject(payload.bookmarkFolders);

  const validPosts = await Post.find({
    _id: { $in: incomingBookmarks },
    isDeleted: false,
  });

  const validPostIds = validPosts.map((post) => post._id.toString());

  for (const post of validPosts) {
    const alreadySaved = post.savedBy.some((id) => id.toString() === userId);
    if (!alreadySaved) {
      post.savedBy.push(userId);
      post.saves = (post.saves || 0) + 1;
      await post.save();
    }
  }

  const user = await loadUser(userId);
  const state = await normalizeAndPersist(user);

  const mergedFolders = mergeFolderDefinitions(
    state.collectionFolders,
    incomingFolders,
  );

  const mergedMap = sanitizeFolderMap(
    mergeFolderMaps(state.bookmarkFolders, incomingFolderMap),
    mergedFolders,
    [...new Set([...state.bookmarks, ...validPostIds])],
  );

  user.bookmarkFolders = mergedFolders;
  user.bookmarkFolderMap = mergedMap;
  await user.save();

  return getBookmarkState(userId);
}
