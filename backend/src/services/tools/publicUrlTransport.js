import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 20;

function errorWithCode(code) {
  return Object.assign(new Error(code), { code });
}

function ipv4IsPublic(address) {
  const [a, b, c] = address.split('.').map(Number);

  return !(
    a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 168)
    || (a === 192 && b === 31 && c === 196)
    || (a === 192 && b === 52 && c === 193)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 175 && c === 48)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
  );
}

function ipv6Groups(address) {
  let value = address.toLowerCase();
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const octets = value.slice(lastColon + 1).split('.').map(Number);
    const firstWord = ((octets[0] << 8) | octets[1]).toString(16);
    const secondWord = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, lastColon + 1)}${firstWord}:${secondWord}`;
  }

  const halves = value.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const zeros = halves.length > 1 ? 8 - left.length - right.length : 0;
  const words = halves.length > 1
    ? [...left, ...Array(zeros).fill('0'), ...right]
    : left;
  return words.map((word) => parseInt(word, 16));
}

function ipIsPublic(address) {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family !== 6) return false;

  const [first, second] = ipv6Groups(address);
  // Global unicast is within 2000::/3. Exclude special-purpose and documentation ranges.
  return first >= 0x2000 && first <= 0x3fff
    && !(first === 0x2001 && (second <= 0x01ff || second === 0x0db8))
    && first !== 0x2002
    && !(first === 0x3fff && second < 0x1000);
}

function parsePublicHttpUrl(input, base) {
  let parsed;
  try {
    parsed = new URL(input, base);
  } catch {
    throw errorWithCode('FETCH_URL_BLOCKED');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw errorWithCode('FETCH_URL_BLOCKED');
  }
  return parsed;
}

function waitForOrAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(errorWithCode('FETCH_ABORTED'));

  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(errorWithCode('FETCH_ABORTED'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function resolvePublicAddress(hostname, signal, lookup) {
  const unwrappedHostname = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(unwrappedHostname);
  if (literalFamily) {
    if (!ipIsPublic(unwrappedHostname)) throw errorWithCode('FETCH_URL_BLOCKED');
    return { address: unwrappedHostname, family: literalFamily };
  }

  const addresses = await waitForOrAbort(
    lookup(unwrappedHostname, { all: true, order: 'verbatim' }),
    signal,
  );
  if (!addresses.length || addresses.some(({ address }) => !ipIsPublic(address))) {
    throw errorWithCode('FETCH_URL_BLOCKED');
  }

  const address = (addresses.find(({ address: candidate }) => isIP(candidate) === 4) || addresses[0]).address;
  return { address, family: isIP(address) };
}

function createPinnedLookup(pinnedAddress) {
  return (_hostname, options, callback) => {
    if (options?.all) {
      callback(null, [pinnedAddress]);
    } else {
      callback(null, pinnedAddress.address, pinnedAddress.family);
    }
  };
}

function requestOnce(url, { signal, lookup, request }) {
  return resolvePublicAddress(url.hostname, signal, lookup).then((pinnedAddress) => {
    if (signal.aborted) throw errorWithCode('FETCH_ABORTED');

    return new Promise((resolve, reject) => {
      let response;
      let settled = false;
      let clientRequest;
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => {
        clientRequest?.destroy();
        response?.destroy();
      };

      try {
        clientRequest = request(url, {
          method: 'GET',
          agent: false,
          lookup: createPinnedLookup(pinnedAddress),
          signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TreeholeAI/1.0; +https://nju.treehole)',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Encoding': 'gzip, deflate, br',
          },
        }, (receivedResponse) => {
          response = receivedResponse;
          // Keep response errors handled between the headers arriving and body iteration.
          response.on('error', () => {});
          settled = true;
          resolve({ request: clientRequest, response, cleanup });
        });
        clientRequest.once('error', (error) => {
          if (!settled) {
            cleanup();
            reject(error);
          } else if (!response.destroyed) {
            response.destroy(error);
          }
        });
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
        clientRequest.end();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  });
}

function byteLimit(maxBytes) {
  let size = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) callback(errorWithCode('FETCH_BODY_TOO_LARGE'));
      else callback(null, chunk);
    },
  });
}

function decodersFor(contentEncoding) {
  const encodings = String(contentEncoding || '')
    .split(',')
    .map((encoding) => encoding.trim().toLowerCase())
    .filter((encoding) => encoding && encoding !== 'identity');

  return encodings.reverse().map((encoding) => {
    if (encoding === 'gzip' || encoding === 'x-gzip') return createGunzip();
    if (encoding === 'deflate') return createInflate();
    if (encoding === 'br') return createBrotliDecompress();
    throw errorWithCode('FETCH_UNSUPPORTED_ENCODING');
  });
}

async function readResponseBody(response, request, maxBytes) {
  const contentLength = Number(response.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    response.destroy();
    request.destroy();
    throw errorWithCode('FETCH_BODY_TOO_LARGE');
  }

  let pipelinePromise;
  const chunks = [];
  try {
    const output = byteLimit(maxBytes);
    const pipes = [response, byteLimit(maxBytes), ...decodersFor(response.headers['content-encoding']), output];
    pipelinePromise = pipeline(...pipes);
    // The output stream is consumed below; retain a handler while it is being drained.
    pipelinePromise.catch(() => {});
    for await (const chunk of output) chunks.push(chunk);
    await pipelinePromise;
  } catch (error) {
    request.destroy();
    response.destroy();
    await pipelinePromise?.catch(() => {});
    throw error;
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchPublicUrl(input, {
  signal: callerSignal,
  timeoutMs,
  maxBytes,
}, dependencies = {}) {
  if (callerSignal?.aborted) throw errorWithCode('FETCH_ABORTED');

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const lookup = dependencies.lookup || ((hostname, options) => dns.lookup(hostname, options));
  const request = dependencies.request || ((url, options, callback) => {
    const client = url.protocol === 'https:' ? https : http;
    return client.request(url, options, callback);
  });

  try {
    let currentUrl = parsePublicHttpUrl(input);
    for (let redirects = 0; ; redirects += 1) {
      if (controller.signal.aborted) throw errorWithCode('FETCH_ABORTED');
      const { request: clientRequest, response, cleanup } = await requestOnce(
        currentUrl,
        { signal: controller.signal, lookup, request },
      );

      const location = response.headers.location;
      if (REDIRECT_STATUSES.has(response.statusCode) && typeof location === 'string') {
        if (redirects >= MAX_REDIRECTS) {
          response.destroy();
          clientRequest.destroy();
          cleanup();
          throw errorWithCode('FETCH_TOO_MANY_REDIRECTS');
        }
        response.destroy();
        clientRequest.destroy();
        cleanup();
        currentUrl = parsePublicHttpUrl(location, currentUrl);
        continue;
      }

      try {
        const body = await readResponseBody(response, clientRequest, maxBytes);
        if (controller.signal.aborted) throw errorWithCode('FETCH_ABORTED');
        return { statusCode: response.statusCode, headers: response.headers, body };
      } finally {
        cleanup();
      }
    }
  } catch (error) {
    if (timedOut) throw errorWithCode('FETCH_TIMEOUT');
    if (callerSignal?.aborted || controller.signal.aborted) throw errorWithCode('FETCH_ABORTED');
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
