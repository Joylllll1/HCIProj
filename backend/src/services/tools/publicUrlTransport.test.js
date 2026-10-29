import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import { fetchPublicUrl } from './publicUrlTransport.js';

class MockRequest extends EventEmitter {
  end() {}

  destroy() {
    this.destroyed = true;
  }
}

function mockNetwork(responses) {
  const requests = [];
  let responseIndex = 0;
  return {
    requests,
    request(url, options, callback) {
      const request = new MockRequest();
      requests.push({ url: url.href, options, request });
      const response = responses[responseIndex++];
      queueMicrotask(() => callback(response));
      return request;
    },
  };
}

function response(statusCode, headers = {}, body = '') {
  const stream = Readable.from([Buffer.from(body)]);
  stream.statusCode = statusCode;
  stream.headers = headers;
  return stream;
}

test('rejects private IPv4 and IPv6 literals before opening a request', async () => {
  const network = mockNetwork([]);
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/']) {
    await assert.rejects(
      fetchPublicUrl(url, { timeoutMs: 100, maxBytes: 1024 }, network),
      { code: 'FETCH_URL_BLOCKED' },
    );
  }
  assert.equal(network.requests.length, 0);
});

test('rejects DNS names with non-public answers before opening a request', async () => {
  const network = mockNetwork([]);
  await assert.rejects(
    fetchPublicUrl('https://public-looking.example/', {
      timeoutMs: 100,
      maxBytes: 1024,
    }, {
      ...network,
      lookup: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.4', family: 4 }],
    }),
    { code: 'FETCH_URL_BLOCKED' },
  );
  assert.equal(network.requests.length, 0);
});

test('validates redirect targets and rejects a redirect to a private literal', async () => {
  const network = mockNetwork([response(302, { location: 'http://192.168.1.1/admin' })]);
  const result = await assert.rejects(
    fetchPublicUrl('https://public.example/start', {
      timeoutMs: 100,
      maxBytes: 1024,
    }, {
      ...network,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }),
    { code: 'FETCH_URL_BLOCKED' },
  );
  assert.equal(result, undefined);
  assert.equal(network.requests.length, 1);
});

test('closes a denied redirect response before rejecting its URL', async () => {
  const stalledRedirect = new PassThrough();
  stalledRedirect.statusCode = 302;
  stalledRedirect.headers = { location: 'ftp://public.example/file' };
  const network = mockNetwork([stalledRedirect]);

  await assert.rejects(
    fetchPublicUrl('https://public.example/start', {
      timeoutMs: 1000,
      maxBytes: 1024,
    }, {
      ...network,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }),
    { code: 'FETCH_URL_BLOCKED' },
  );
  assert.equal(network.requests[0].request.destroyed, true);
  assert.equal(stalledRedirect.destroyed, true);
});

test('resolves and rejects a redirect hostname that points to a private address', async () => {
  const network = mockNetwork([response(302, { location: 'http://private.example/admin' })]);
  let lookups = 0;
  await assert.rejects(
    fetchPublicUrl('https://public.example/start', {
      timeoutMs: 100,
      maxBytes: 1024,
    }, {
      ...network,
      lookup: async () => {
        lookups += 1;
        return [{ address: lookups === 1 ? '93.184.216.34' : '10.0.0.4', family: 4 }];
      },
    }),
    { code: 'FETCH_URL_BLOCKED' },
  );
  assert.equal(network.requests.length, 1);
  assert.equal(lookups, 2);
});

test('follows relative redirects and pins the validated public DNS address', async () => {
  const network = mockNetwork([
    response(302, { location: '/news/story' }),
    response(200, {}, '<title>News</title><p>Public page</p>'),
  ]);
  const lookupHosts = [];
  const result = await fetchPublicUrl('https://public.example/start', {
    timeoutMs: 100,
    maxBytes: 1024,
  }, {
    ...network,
    lookup: async (hostname, options) => {
      lookupHosts.push([hostname, options]);
      return [
        { address: '2606:4700:4700::1111', family: 6 },
        { address: '93.184.216.34', family: 4 },
      ];
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '<title>News</title><p>Public page</p>');
  assert.deepEqual(network.requests.map(({ url }) => url), [
    'https://public.example/start',
    'https://public.example/news/story',
  ]);
  assert.equal(lookupHosts.length, 2);
  for (const { options } of network.requests) {
    const pinned = await new Promise((resolve, reject) => {
      options.lookup('public.example', {}, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    assert.deepEqual(pinned, { address: '93.184.216.34', family: 4 });
    assert.equal(options.agent, false);
  }
});

test('decodes gzip, deflate, and Brotli HTML responses', async () => {
  const html = '<title>Compressed</title><p>Public page</p>';
  const cases = [
    ['gzip', gzipSync(html)],
    ['deflate', deflateSync(html)],
    ['br', brotliCompressSync(html)],
  ];

  for (const [encoding, bytes] of cases) {
    const compressedResponse = Readable.from([bytes]);
    compressedResponse.statusCode = 200;
    compressedResponse.headers = { 'content-encoding': encoding };
    const encodedNetwork = mockNetwork([compressedResponse]);

    const result = await fetchPublicUrl(`https://public.example/${encoding}`, {
      timeoutMs: 100,
      maxBytes: 1024,
    }, {
      ...encodedNetwork,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });
    assert.equal(result.body, html);
  }
});

test('caps decompressed bytes and destroys a compressed response that expands too far', async () => {
  const compressedResponse = Readable.from([gzipSync('x'.repeat(2048))]);
  compressedResponse.statusCode = 200;
  compressedResponse.headers = { 'content-encoding': 'gzip' };
  const network = mockNetwork([compressedResponse]);

  await assert.rejects(
    fetchPublicUrl('https://public.example/large-compressed', {
      timeoutMs: 100,
      maxBytes: 128,
    }, {
      ...network,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }),
    { code: 'FETCH_BODY_TOO_LARGE' },
  );
  assert.equal(network.requests[0].request.destroyed, true);
  assert.equal(compressedResponse.destroyed, true);
});

test('caller abort destroys a response that stalls after headers', async () => {
  const stalledResponse = new PassThrough();
  stalledResponse.statusCode = 200;
  stalledResponse.headers = {};
  const network = mockNetwork([stalledResponse]);
  const controller = new AbortController();
  const pending = fetchPublicUrl('https://public.example/stalled', {
    signal: controller.signal,
    timeoutMs: 1000,
    maxBytes: 1024,
  }, {
    ...network,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
  });

  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, { code: 'FETCH_ABORTED' });
  assert.equal(network.requests[0].request.destroyed, true);
  assert.equal(stalledResponse.destroyed, true);
});

test('timeout covers a response body that stalls after headers', async () => {
  const stalledResponse = new PassThrough();
  stalledResponse.statusCode = 200;
  stalledResponse.headers = {};
  const network = mockNetwork([stalledResponse]);

  await assert.rejects(
    fetchPublicUrl('https://public.example/stalled', {
      timeoutMs: 20,
      maxBytes: 1024,
    }, {
      ...network,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }),
    { code: 'FETCH_TIMEOUT' },
  );
  assert.equal(network.requests[0].request.destroyed, true);
  assert.equal(stalledResponse.destroyed, true);
});

test('stops reading when the raw response exceeds the byte limit', async () => {
  const network = mockNetwork([response(200, {}, '12345')]);
  await assert.rejects(
    fetchPublicUrl('https://public.example/large', {
      timeoutMs: 100,
      maxBytes: 4,
    }, {
      ...network,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }),
    { code: 'FETCH_BODY_TOO_LARGE' },
  );
  assert.equal(network.requests[0].request.destroyed, true);
});
