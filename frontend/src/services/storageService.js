/**
 * StorageService — 封装 localStorage 读写操作
 * 所有方法返回 Promise，后续可无缝替换为 Axios API 调用
 */

function load(key, fallback = null) {
  return new Promise((resolve) => {
    try {
      const raw = localStorage.getItem(key);
      resolve(raw ? JSON.parse(raw) : fallback);
    } catch {
      resolve(fallback);
    }
  });
}

function save(key, value) {
  return new Promise((resolve) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded or other error */ }
    resolve();
  });
}

function remove(key) {
  return new Promise((resolve) => {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
    resolve();
  });
}

export const storageService = { load, save, remove };
