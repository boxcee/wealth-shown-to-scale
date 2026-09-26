import { LANGUAGES } from '../i18n/languages';
import { currentLanguage, t } from '../i18n';
import { PAGES, pathFor, type Page } from '../router';
import { getCurrency, getData, isStale } from '../data';
import { date, escapeHtml, type Currency } from '../format';
import type { SourcedValue } from '../data/types';

const NAV_PAGES: Page[] = ['scroll', 'germany', 'taxes', 'objections', 'methodology', 'credits'];

export function renderHeader(page: Page): string {
  const lang = currentLanguage().code;
  const cur = getCurrency();
  const langLinks = LANGUAGES.map(
    (l) =>
      `<a href="${pathFor(l.code, page, location.hash)}" lang="${l.code}" hreflang="${l.code}" data-lang="${l.code}" ${l.code === lang ? 'aria-current="true"' : ''}>${escapeHtml(l.name)}</a>`,
  ).join('');
  const nav = NAV_PAGES.map((p) => `<a href="${pathFor(lang, p)}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${escapeHtml(t(`nav.${p}`))}</a>`).join('');
  return `
    <header class="site-header">
      <a class="brand" href="${pathFor(lang, 'scroll')}">${escapeHtml(t('meta.siteName'))}</a>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="${escapeHtml(t('nav.menu'))}">☰</button>
      <nav id="site-nav" class="site-nav" aria-label="${escapeHtml(t('nav.menu'))}">${nav}</nav>
      <div class="controls">
        <div class="switch" role="group" aria-label="${escapeHtml(t('nav.currency'))}">
          ${(['EUR', 'USD'] as Currency[]).map((c) => `<button type="button" data-currency="${c}" aria-pressed="${c === cur}">${c === 'EUR' ? '€' : '$'} ${c}</button>`).join('')}
        </div>
        <div class="switch lang-switch" role="group" aria-label="${escapeHtml(t('nav.language'))}">${langLinks}</div>
      </div>
    </header>`;
}

export function renderFooter(): string {
  const lang = currentLanguage().code;
  const files = Object.values(getData()).filter((f): f is { meta: { updated_at: string } } => !!f && typeof f === 'object' && 'meta' in f);
  const latest = files.map((f) => f.meta.updated_at).sort().pop() ?? '';
  return `
    <footer class="site-footer">
      <p>${escapeHtml(t('footer.text', { date: date(latest) }))}</p>
      <p>
        <a href="${pathFor(lang, 'imprint')}">${escapeHtml(t('nav.imprint'))}</a> ·
        <a href="${pathFor(lang, 'privacy')}">${escapeHtml(t('nav.privacy'))}</a> ·
        <a href="${pathFor(lang, 'methodology')}">${escapeHtml(t('nav.methodology'))}</a> ·
        <a href="https://github.com/boxcee/wealth-shown-to-scale" rel="noopener">${escapeHtml(t('footer.github'))}</a>
      </p>
    </footer>`;
}

/** Banner listing how many values on the page are older than their max age. */
export function staleBanner(values: SourcedValue[]): string {
  const n = values.filter((v) => isStale(v)).length;
  if (!n) return '';
  return `<p class="stale-banner" role="note">${escapeHtml(t('common.staleBanner', { count: n }))}</p>`;
}

export function currencyNote(): string {
  const fx = getData().exchange_rates.values.usd_per_eur;
  return `<p class="muted small">${escapeHtml(t('common.inCurrency', { currency: getCurrency(), rate: fx.value, date: fx.as_of ?? fx.retrieved_at }))}</p>`;
}

export function pageShell(page: Page, main: string): string {
  return `${renderHeader(page)}<main id="main" class="page page-${page}" tabindex="-1">${main}</main>${renderFooter()}`;
}

export function allPages(): readonly Page[] {
  return PAGES;
}
