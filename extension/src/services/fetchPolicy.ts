// Validation policy for the background worker's Reddit fetch relay.
// The relay exists so the content script can retry a request from the extension origin when the
// page-origin fetch fails. Without a policy it would be an authenticated open proxy for anything
// that could message the worker, so only the exact Reddit read endpoints RedditDIG uses are allowed.

import { isRedditHostname, toSafeRedditUrl } from './url';

export interface RelayRequest {
  url: string;
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    credentials: 'include';
    redirect: 'follow';
  };
}

export type RelayValidation = { ok: true; request: RelayRequest } | { ok: false; reason: string };

const READ_PATHS: RegExp[] = [
  /^\/api\/info(?:\.json)?$/i,
  /^\/api\/morechildren(?:\.json)?$/i,
  /^\/(?:(?:r|u|user)\/[^/]+\/)?comments\/[a-z0-9]+(?:(?:\/[^/]+)*)(?:\.json)?\/?$/i,
  /^\/comments\/[a-z0-9]+(?:(?:\/[^/]+)*)(?:\.json)?\/?$/i
];
const POST_PATHS: RegExp[] = [/^\/api\/morechildren(?:\.json)?$/i];

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 512;

export function validateRelayRequest(message: unknown): RelayValidation {
  if (!message || typeof message !== 'object') return { ok: false, reason: 'Malformed request.' };
  const m = message as Record<string, unknown>;

  const safe = toSafeRedditUrl(m.url);
  if (!safe) return { ok: false, reason: 'URL is not an https Reddit URL.' };
  const parsed = new URL(safe);
  if (!isRedditHostname(parsed.hostname)) return { ok: false, reason: 'Host is not reddit.com.' };

  const method = typeof m.method === 'string' ? m.method.toUpperCase() : 'GET';
  if (method !== 'GET' && method !== 'POST') return { ok: false, reason: 'Method not allowed.' };

  const allowedPaths = method === 'POST' ? POST_PATHS : READ_PATHS;
  if (!allowedPaths.some((re) => re.test(parsed.pathname))) {
    return { ok: false, reason: 'Endpoint not allowed.' };
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const rawHeaders = m.headers && typeof m.headers === 'object' ? (m.headers as Record<string, unknown>) : {};
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (typeof value !== 'string') continue;
    const key = name.toLowerCase();
    if (key === 'x-csrf-token' && value.length <= MAX_TOKEN_LENGTH && /^[\x21-\x7e]+$/.test(value)) {
      headers['X-Csrf-Token'] = value;
    } else if (key === 'content-type' && method === 'POST' && value === 'application/x-www-form-urlencoded') {
      headers['Content-Type'] = value;
    }
  }

  let body: string | undefined;
  if (m.body !== undefined && m.body !== null && m.body !== '') {
    if (method !== 'POST') return { ok: false, reason: 'Body not allowed for GET.' };
    if (typeof m.body !== 'string' || m.body.length > MAX_BODY_BYTES) {
      return { ok: false, reason: 'Invalid body.' };
    }
    body = m.body;
  }

  return {
    ok: true,
    request: {
      url: safe,
      init: { method, headers, ...(body !== undefined ? { body } : {}), credentials: 'include', redirect: 'follow' }
    }
  };
}
