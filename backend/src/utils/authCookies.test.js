import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAuthCookies,
  extractAccessToken,
  extractRefreshToken,
  getCookieOptions,
  getTokensFromCookies,
  setAuthCookies,
} from './authCookies.js';

test('getCookieOptions returns secure false outside production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const options = getCookieOptions(1234);

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.secure, false);
  assert.equal(options.path, '/');
  assert.equal(options.maxAge, 1234);

  process.env.NODE_ENV = originalNodeEnv;
});

test('getTokensFromCookies parses access and refresh cookies', () => {
  const req = {
    headers: {
      cookie: 'foo=bar; accessToken=access-123; refreshToken=refresh-456; hello=world',
    },
  };

  assert.deepEqual(getTokensFromCookies(req), {
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
  });
});

test('extract token helpers return null when cookies are missing', () => {
  const req = { headers: {} };

  assert.equal(extractAccessToken(req), null);
  assert.equal(extractRefreshToken(req), null);
});

test('setAuthCookies writes access refresh and session hint cookies', () => {
  const originalAccessMaxAge = process.env.ACCESS_COOKIE_MAX_AGE_MS;
  const originalRefreshMaxAge = process.env.REFRESH_COOKIE_MAX_AGE_MS;
  process.env.ACCESS_COOKIE_MAX_AGE_MS = '60000';
  process.env.REFRESH_COOKIE_MAX_AGE_MS = '120000';

  const calls = [];
  const res = {
    cookie(name, value, options) {
      calls.push({ name, value, options });
    },
  };

  setAuthCookies(res, 'access-token', 'refresh-token');

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.name), ['accessToken', 'refreshToken', 'sessionHint']);
  assert.equal(calls[0].value, 'access-token');
  assert.equal(calls[1].value, 'refresh-token');
  assert.equal(calls[2].value, '1');
  assert.equal(calls[0].options.httpOnly, true);
  assert.equal(calls[1].options.httpOnly, true);
  assert.equal(calls[2].options.httpOnly, false);
  assert.equal(calls[0].options.maxAge, 60000);
  assert.equal(calls[1].options.maxAge, 120000);
  assert.equal(calls[2].options.maxAge, 120000);

  process.env.ACCESS_COOKIE_MAX_AGE_MS = originalAccessMaxAge;
  process.env.REFRESH_COOKIE_MAX_AGE_MS = originalRefreshMaxAge;
});

test('clearAuthCookies clears all auth cookies', () => {
  const calls = [];
  const res = {
    clearCookie(name, options) {
      calls.push({ name, options });
    },
  };

  clearAuthCookies(res);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.name), ['accessToken', 'refreshToken', 'sessionHint']);
  assert.equal(calls[0].options.maxAge, 0);
  assert.equal(calls[1].options.maxAge, 0);
  assert.equal(calls[2].options.maxAge, 0);
});
