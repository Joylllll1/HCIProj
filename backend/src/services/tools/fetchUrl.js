import { fetchPublicUrl } from './publicUrlTransport.js';

const FETCH_TIMEOUT_MS = parseInt(process.env.AI_TOOL_TIMEOUT_MS || '8000', 10);
const MAX_EXTRACTED_TEXT_LENGTH = parseInt(process.env.AI_FETCH_URL_MAX_CHARS || '6000', 10);
const MAX_RESPONSE_BYTES = parseInt(process.env.AI_FETCH_URL_MAX_BYTES || '1048576', 10);

function stripHtmlToText(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractTitle(html = '', fallbackUrl = '') {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] || fallbackUrl || '').replace(/\s+/g, ' ').trim();
}

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export const schema = {
  type: 'function',
  function: {
    name: 'fetch_url',
    description: '获取指定网页正文内容，用于在搜索结果摘要不足时进一步核实事实',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的网页链接' },
      },
      required: ['url'],
    },
  },
};

export async function handler({ url }, signal) {
  if (!url?.trim() || !isAllowedUrl(url)) {
    return { ok: false, error: 'URL 无效' };
  }

  try {
    if (signal?.aborted) {
      return { ok: false, error: '请求已取消' };
    }

    const response = await fetchPublicUrl(url, {
      signal,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { ok: false, error: `网页请求失败 (${response.statusCode})` };
    }

    const title = extractTitle(response.body, url);
    const text = stripHtmlToText(response.body).slice(0, MAX_EXTRACTED_TEXT_LENGTH);

    if (!text) {
      return { ok: false, error: '网页正文为空' };
    }

    return {
      ok: true,
      url,
      title,
      content: text,
    };
  } catch (error) {
    if (error?.code === 'FETCH_TIMEOUT') {
      return { ok: false, error: '网页抓取超时' };
    }
    if (error?.code === 'FETCH_ABORTED' || signal?.aborted) {
      return { ok: false, error: '请求已取消' };
    }
    if (error?.code === 'FETCH_BODY_TOO_LARGE') {
      return { ok: false, error: '网页内容过大' };
    }
    if (error?.code === 'FETCH_URL_BLOCKED') {
      return { ok: false, error: 'URL 无效' };
    }
    return { ok: false, error: '网页抓取失败' };
  }
}
