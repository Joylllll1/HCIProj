import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';

test('sign and verify access token round trips user id', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-access-secret';

  const token = signAccessToken('user-123');
  const decoded = verifyAccessToken(token);

  assert.equal(decoded.id, 'user-123');

  process.env.JWT_SECRET = originalSecret;
});

test('sign and verify refresh token round trips user id', () => {
  const originalSecret = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  const token = signRefreshToken('user-456');
  const decoded = verifyRefreshToken(token);

  assert.equal(decoded.id, 'user-456');

  process.env.JWT_REFRESH_SECRET = originalSecret;
});

test('verifyAccessToken rejects token signed with another secret', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secret-a';

  const token = signAccessToken('user-789');

  process.env.JWT_SECRET = 'secret-b';

  assert.throws(() => verifyAccessToken(token));

  process.env.JWT_SECRET = originalSecret;
});
