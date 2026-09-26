/**
 * Checks every source_url / url in data/*.json with a HEAD/GET request and prints a table.
 * Informational: never fails the build (many publishers block bots), but the summary is
 * attached to the monthly issue so dead links get noticed.
 *
 *   npm run update-data && node --import tsx scripts/check-links.ts
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIR, readJson } from './lib/io.js';
import { USER_AGENT } from './lib/http.js';
import { REPORT_DIR } from './lib/report.js';

function collectUrls(node: unknown, out: Map<string, Set<string>>, file: string): void {
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if ((k === 'source_url' || k === 'url' || k === 'mirror_url' || k === 'repo_url' || k === 'profile_url') && typeof v === 'string' && v.startsWith('http')) {
      if (!out.has(v)) out.set(v, new Set());
      out.get(v)!.add(file);
    } else collectUrls(v, out, file);
  }
}

async function check(url: string): Promise<number | string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
    return res.status;
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'timeout' : 'error';
  } finally {
    clearTimeout(t);
  }
}

const urls = new Map<string, Set<string>>();
for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) collectUrls(readJson(resolve(DATA_DIR, f)), urls, f);

const rows: string[] = ['| Status | URL | Used in |', '|---|---|---|'];
let bad = 0;
const entries = [...urls.entries()];
const results = await Promise.all(entries.map(([u]) => check(u)));
entries.forEach(([u, files], i) => {
  const s = results[i];
  const ok = typeof s === 'number' && s < 400;
  if (!ok) bad++;
  rows.push(`| ${ok ? '✓' : '✗'} ${s} | ${u} | ${[...files].join(', ')} |`);
  console.log(`${ok ? '✓' : '✗'} ${String(s).padEnd(7)} ${u}`);
});
mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(resolve(REPORT_DIR, 'links.md'), `${urls.size} links checked, ${bad} not reachable from the runner (403/blocked pages are often fine in a browser).\n\n${rows.join('\n')}\n`);
console.log(`\n${urls.size} links, ${bad} problems (see .pipeline/links.md)`);
