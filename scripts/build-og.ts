/**
 * Renders one Open Graph image (1200×630 PNG) per language × page into public/og/
 * using the headless Chromium that Playwright ships. Run `npm run og` after changing
 * titles or data; the images are committed so the Pages build needs no browser.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, readJson } from './lib/io.js';
import { LANGUAGES } from '../src/i18n/languages.ts';
import { findChromium } from './lib/chromium.js';

const PAGES = ['scroll', 'rice', 'spend', 'germany', 'taxes', 'objections', 'methodology', 'credits', 'imprint', 'privacy'];
const OUT = resolve(ROOT, 'public', 'og');
mkdirSync(OUT, { recursive: true });

const world = readJson<{ people: { name: string; wealth: { value: number } }[] }>(resolve(ROOT, 'data', 'wealth_world.json'));
const ref = readJson<{ values: Record<string, { value: number }> }>(resolve(ROOT, 'data', 'reference.json'));
const top = world.people[0];
const median = ref.values.de_median_gross_annual_fulltime.value;

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function html(lang: string, title: string, description: string, siteName: string): string {
  const fmt = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 });
  const bars = [
    { label: lang === 'de' ? 'Medianverdienst / Jahr' : 'Median earnings / year', w: Math.max(2, median / 1000 / 4), color: '#60a5fa' },
    { label: lang === 'de' ? 'Eine Million' : 'One million', w: 1000 / 4, color: '#34d399' },
    { label: `${top.name}: ${fmt.format(top.wealth.value)}`, w: 100000, color: '#f87171' },
  ];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
    body{margin:0;width:1200px;height:630px;background:#0f1218;color:#eceef2;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;overflow:hidden}
    .wrap{padding:56px 64px;position:relative;height:630px;box-sizing:border-box}
    .site{font-size:26px;color:#a0a7b4;letter-spacing:.02em}
    h1{font-size:58px;line-height:1.1;margin:18px 0 14px;max-width:1000px}
    p{font-size:28px;color:#c8cdd6;max-width:1000px;margin:0;line-height:1.35}
    .bars{position:absolute;left:64px;right:0;bottom:56px}
    .bar{height:34px;margin:10px 0;display:flex;align-items:center;gap:14px;font-size:20px;color:#a0a7b4;white-space:nowrap}
    .bar i{display:block;height:34px;border-radius:4px}
    .scale{position:absolute;right:64px;top:56px;font-size:20px;color:#a0a7b4}
  </style></head><body><div class="wrap">
    <div class="site">${esc(siteName)}</div>
    <div class="scale">1 px = $1,000</div>
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <div class="bars">${bars.map((b) => `<div class="bar"><i style="width:${Math.min(1000, b.w)}px;background:${b.color}"></i><span>${esc(b.label)}${b.w > 1000 ? ' …' : ''}</span></div>`).join('')}</div>
  </div></body></html>`;
}

const executablePath = findChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let n = 0;
for (const lang of LANGUAGES) {
  const msgs = readJson<Record<string, any>>(resolve(ROOT, 'src', 'i18n', 'locales', `${lang.code}.json`));
  for (const p of PAGES) {
    await page.setContent(html(lang.code, msgs.pages[p].title, msgs.pages[p].description, msgs.meta.siteName), { waitUntil: 'load' });
    await page.screenshot({ path: resolve(OUT, `${lang.code}-${p}.png`), type: 'png' });
    n++;
  }
}
await browser.close();
console.log(`✓ ${n} OG images written to public/og/`);
