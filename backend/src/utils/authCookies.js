const ACCESS_COOKIE_NAME = 'accessToken';
const REFRESH_COOKIE_NAME = 'refreshToken';
const SESSION_HINT_COOKIE_NAME = 'sessionHint';

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!key) return acc;

      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function getCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

function getSessionHintCookieOptions(maxAge) {
  return {
    httpOnly: false,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function getTokensFromCookies(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return {
    accessToken: cookies[ACCESS_COOKIE_NAME] || null,
    refreshToken: cookies[REFRESH_COOKIE_NAME] || null,
  };
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const accessMaxAge = Number(process.env.ACCESS_COOKIE_MAX_AGE_MS || 15 * 60 * 1000);
  const refreshMaxAge = Number(process.env.REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

  res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(accessMaxAge));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(refreshMaxAge));
  res.cookie(SESSION_HINT_COOKIE_NAME, '1', getSessionHintCookieOptions(refreshMaxAge));
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, getCookieOptions(0));
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(0));
  res.clearCookie(SESSION_HINT_COOKIE_NAME, getSessionHintCookieOptions(0));
}

export function extractAccessToken(req) {
  const { accessToken } = getTokensFromCookies(req);
  return accessToken || null;
}

export function extractRefreshToken(req) {
  const { refreshToken } = getTokensFromCookies(req);
  return refreshToken || null;
}
