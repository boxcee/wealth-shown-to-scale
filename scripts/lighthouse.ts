/**
 * Runs Lighthouse (performance + accessibility) against the built site served by
 * `vite preview`. Requires a Chromium; uses the same lookup as Playwright.
 *
 *   npm run build && npm run lighthouse
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/io.js';
import { findChromium } from './lib/chromium.js';

const base = process.env.BASE_PATH ?? '/wealth-shown-to-scale/';
const port = 4174;
const pages = ['en/', 'de/', 'en/taxes/', 'de/spend/'];
const outDir = resolve(ROOT, '.lighthouse');
mkdirSync(outDir, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const chrome = findChromium();
let worst = { performance: 1, accessibility: 1 };
try {
  for (const p of pages) {
    const url = `http://127.0.0.1:${port}${base}${p}`;
    const out = resolve(outDir, `${p.replace(/\//g, '_') || 'root'}.json`);
    const args = ['-y', 'lighthouse@12', url, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility', '--chrome-flags=--headless=new --no-sandbox --disable-gpu', '--preset=desktop'];
    await new Promise<void>((res, rej) => {
      const ps = spawn('npx', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) } });
      ps.on('exit', (code) => (code === 0 ? res() : rej(new Error(`lighthouse exited ${code}`))));
    });
    const json = JSON.parse((await import('node:fs')).readFileSync(out, 'utf8'));
    const perf = json.categories.performance.score;
    const a11y = json.categories.accessibility.score;
    worst = { performance: Math.min(worst.performance, perf), accessibility: Math.min(worst.accessibility, a11y) };
    console.log(`${url}: performance ${Math.round(perf * 100)}, accessibility ${Math.round(a11y * 100)}`);
  }
  writeFileSync(resolve(outDir, 'summary.json'), JSON.stringify(worst, null, 2));
  console.log(`worst: performance ${Math.round(worst.performance * 100)}, accessibility ${Math.round(worst.accessibility * 100)}`);
  if (worst.performance < 0.9 || worst.accessibility < 0.95) process.exitCode = 1;
} finally {
  server.kill();
}
