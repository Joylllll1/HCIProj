import useAuthStore from '../store/authStore';

const API_BASE = '';
const REFRESH_PATH = '/api/auth/refresh';
const SKIP_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
]);

let refreshPromise = null;

function hasSessionHintCookie() {
  if (typeof document === 'undefined') return false;

  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((cookie) => cookie === 'sessionHint=1' || cookie.startsWith('sessionHint=1;'));
}

function buildHeaders(options = {}) {
  const headers = { ...options.headers };
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function createError(data, status, fallbackMessage = '请求失败') {
  const error = new Error(data?.error || data?.message || fallbackMessage);
  error.status = status;
  error.data = data;
  return error;
}

async function parseJson(response) {
  return response.json().catch(() => null);
}

function clearAuthState() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    loading: false,
    initialized: true,
    error: null,
  });
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/') {
    window.location.assign('/');
  }
}

async function handleAuthFailure() {
  clearAuthState();
  redirectToLogin();
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE}${REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });

      const data = await parseJson(response);
      if (!response.ok) {
        throw createError(data, response.status, '登录已过期，请重新登录');
      }

      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function shouldAttemptRefresh(path, options, response) {
  if (options.skipAuthRefresh || options._retried) return false;
  if (response.status !== 401) return false;
  return !SKIP_REFRESH_PATHS.has(path);
}

function shouldRedirectOnAuthFailure(options = {}) {
  return options.authFailureMode !== 'silent';
}

async function doFetch(path, options = {}) {
  const fetchOptions = { ...options };
  delete fetchOptions.skipAuthRefresh;
  delete fetchOptions.authFailureMode;
  delete fetchOptions._retried;

  return fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: buildHeaders(options),
    credentials: 'same-origin',
  });
}

export async function fetchWithAuthRetry(path, options = {}) {
  let response = await doFetch(path, options);

  if (!shouldAttemptRefresh(path, options, response)) {
    if (response.status === 401 && shouldRedirectOnAuthFailure(options)) {
      await handleAuthFailure();
    }
    return response;
  }

  try {
    await refreshSession();
  } catch {
    if (shouldRedirectOnAuthFailure(options)) {
      await handleAuthFailure();
    } else {
      clearAuthState();
    }
    return response;
  }

  response = await doFetch(path, { ...options, _retried: true });

  if (response.status === 401) {
    if (shouldRedirectOnAuthFailure(options)) {
      await handleAuthFailure();
    } else {
      clearAuthState();
    }
  }

  return response;
}

export async function request(path, options = {}) {
  const response = await fetchWithAuthRetry(path, options);
  const data = await parseJson(response);

  if (!response.ok) {
    throw createError(data, response.status);
  }

  return data;
}

export { clearAuthState, handleAuthFailure, hasSessionHintCookie, refreshSession };

export default request;
