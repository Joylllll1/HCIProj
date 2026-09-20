import test from 'node:test';
import assert from 'node:assert/strict';
import { sendAuthSuccess, sendLoggedOut } from './authResponse.js';

function createMockResponse() {
  return {
    statusCode: 200,
    cookies: [],
    clearedCookies: [],
    jsonPayload: null,
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };
}

test('sendAuthSuccess sets auth cookies and strips tokens from json payload', () => {
  const res = createMockResponse();

  sendAuthSuccess(res, 201, {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: { id: 'user-1' },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.cookies.length, 3);
  assert.deepEqual(res.jsonPayload, {
    user: { id: 'user-1' },
  });
});

test('sendAuthSuccess skips cookie writes when tokens are absent', () => {
  const res = createMockResponse();

  sendAuthSuccess(res, 200, {
    message: 'ok',
  });

  assert.equal(res.cookies.length, 0);
  assert.deepEqual(res.jsonPayload, {
    message: 'ok',
  });
});

test('sendLoggedOut clears auth cookies and returns logout message', () => {
  const res = createMockResponse();

  sendLoggedOut(res);

  assert.equal(res.clearedCookies.length, 3);
  assert.deepEqual(res.jsonPayload, {
    message: '已退出登录',
  });
});
