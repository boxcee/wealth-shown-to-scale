/**
 * Post-build: turns dist/index.html into one static shell per language × page
 * (dist/<lang>/<page>/index.html) with the right <html lang>, title, description,
 * canonical, hreflang alternates and Open Graph tags, plus a 404.html fallback
 * for GitHub Pages so unknown paths still boot the app.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, readJson } from './lib/io.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../src/i18n/languages.ts';

const PAGES = ['scroll', 'rice', 'spend', 'germany', 'taxes', 'objections', 'methodology', 'credits', 'imprint', 'privacy'];
const DIST = resolve(ROOT, 'dist');
const BASE = (process.env.BASE_PATH ?? '/wealth-shown-to-scale/').replace(/\/?$/, '/');
const SITE_URL = (process.env.SITE_URL ?? 'https://boxcee.github.io').replace(/\/$/, '');

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const template = readFileSync(resolve(DIST, 'index.html'), 'utf8');
const locales = Object.fromEntries(LANGUAGES.map((l) => [l.code, readJson<Record<string, any>>(resolve(ROOT, 'src', 'i18n', 'locales', `${l.code}.json`))]));

function pagePath(lang: string, page: string): string {
  return `${BASE}${lang}/${page === 'scroll' ? '' : page + '/'}`;
}

let count = 0;
for (const lang of LANGUAGES) {
  for (const page of PAGES) {
    const msgs = locales[lang.code];
    const title: string = msgs.pages?.[page]?.title ?? locales[DEFAULT_LANGUAGE].pages[page].title;
    const description: string = msgs.pages?.[page]?.description ?? locales[DEFAULT_LANGUAGE].pages[page].description;
    const siteName: string = msgs.meta?.siteName ?? locales[DEFAULT_LANGUAGE].meta.siteName;
    const url = `${SITE_URL}${pagePath(lang.code, page)}`;
    const ogImage = `${SITE_URL}${BASE}og/${lang.code}-${page}.png`;
    const alternates = LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${pagePath(l.code, page)}" />`).join('\n    ');
    const meta = `
    <link rel="canonical" href="${url}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath(DEFAULT_LANGUAGE, page)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(siteName)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${lang.locale.replace('-', '_')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ogImage}" />`;
    const html = template
      .replace('<html lang="en">', `<html lang="${lang.code}"${lang.dir ? ` dir="${lang.dir}"` : ''}>`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} · ${esc(siteName)}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
      .replace('<!--PAGE_META-->', meta.trim())
      .replace('>Skip to content<', `>${esc(msgs.nav?.skipToContent ?? 'Skip to content')}<`);
    const dir = resolve(DIST, lang.code, page === 'scroll' ? '' : page);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), html);
    count++;
  }
}

// Root: language-detecting shell (the app redirects) and SPA fallback.
const rootAlternates = LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${pagePath(l.code, 'scroll')}" />`).join('\n    ');
const rootHtml = template.replace('<!--PAGE_META-->', `${rootAlternates}\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath(DEFAULT_LANGUAGE, 'scroll')}" />`);
writeFileSync(resolve(DIST, 'index.html'), rootHtml);
copyFileSync(resolve(DIST, 'index.html'), resolve(DIST, '404.html'));
writeFileSync(resolve(DIST, '.nojekyll'), '');
if (!existsSync(resolve(DIST, 'og'))) console.warn('! dist/og missing: run `npm run og` to generate Open Graph images into public/og');

// robots + sitemap
const urls = LANGUAGES.flatMap((l) => PAGES.map((p) => `${SITE_URL}${pagePath(l.code, p)}`));
writeFileSync(resolve(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(resolve(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}${BASE}sitemap.xml\n`);
console.log(`✓ ${count} static page shells written (${LANGUAGES.length} languages × ${PAGES.length} pages), plus 404.html, sitemap.xml, robots.txt`);
