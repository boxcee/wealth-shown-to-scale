import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './io.js';

export const USER_AGENT =
  'wealth-shown-to-scale data pipeline (+https://github.com/boxcee/wealth-shown-to-scale)';

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** When set, the fixture file is read instead of the network (tests / --offline). */
  fixture?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export function fixturePath(name: string): string {
  return resolve(ROOT, 'tests', 'fixtures', name);
}

/** Fetch text with timeout, retries and a fixture fallback for offline runs. */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  if (opts.fixture) {
    return readFileSync(fixturePath(opts.fixture), 'utf8');
  }
  const retries = opts.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        body: opts.body,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/xml, */*', ...opts.headers },
        signal: controller.signal,
      });
      if (!res.ok) throw new HttpError(url, res.status);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  return JSON.parse(await fetchText(url, opts)) as T;
}
