import { detectLanguage, isLanguage, DEFAULT_LANGUAGE } from './i18n/languages';

export const PAGES = ['scroll', 'rice', 'spend', 'germany', 'taxes', 'objections', 'methodology', 'credits', 'imprint', 'privacy'] as const;
export type Page = (typeof PAGES)[number];

export interface Route {
  lang: string;
  page: Page;
}

export const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';

/** Build a URL path for a language and page (home = scroll). */
export function pathFor(lang: string, page: Page, hash = ''): string {
  return `${BASE}${lang}/${page === 'scroll' ? '' : page + '/'}${hash}`;
}

/**
 * Parses location into {lang, page}. Returns null when the URL has no language
 * segment; the caller then redirects to the detected language.
 */
export function parseLocation(loc: Location = window.location): { route: Route | null; langFromQuery: string | null; needsRedirect: boolean } {
  const params = new URLSearchParams(loc.search);
  const langFromQuery = params.get('lang');
  let rel = loc.pathname.startsWith(BASE) ? loc.pathname.slice(BASE.length) : loc.pathname.replace(/^\//, '');
  rel = rel.replace(/index\.html$/, '');
  const parts = rel.split('/').filter(Boolean);
  let lang: string | null = null;
  let pageSeg = '';
  if (parts.length && isLanguage(parts[0])) {
    lang = parts[0];
    pageSeg = parts[1] ?? '';
  } else {
    pageSeg = parts[0] ?? '';
  }
  const page = (PAGES as readonly string[]).includes(pageSeg) ? (pageSeg as Page) : pageSeg === '' ? 'scroll' : null;
  if (langFromQuery && isLanguage(langFromQuery)) {
    return { route: { lang: langFromQuery, page: page ?? 'scroll' }, langFromQuery, needsRedirect: true };
  }
  if (!lang) {
    return { route: null, langFromQuery: null, needsRedirect: true };
  }
  return { route: { lang, page: page ?? 'scroll' }, langFromQuery: null, needsRedirect: page === null };
}

/** Decide the language for a visitor without one in the URL. */
export function resolveLanguage(langFromQuery: string | null): string {
  if (langFromQuery && isLanguage(langFromQuery)) return langFromQuery;
  try {
    const stored = localStorage.getItem('wsts.lang');
    if (isLanguage(stored)) return stored;
  } catch {
    /* ignore */
  }
  return detectLanguage(navigator.languages ?? [navigator.language ?? DEFAULT_LANGUAGE]);
}

export function rememberLanguage(lang: string): void {
  try {
    localStorage.setItem('wsts.lang', lang);
  } catch {
    /* ignore */
  }
}
