/**
 * The "sourced number" component. Every figure in the UI goes through num():
 * it renders the formatted value plus a small ⓘ button that opens a popover with
 * source, link, retrieval date, reference period, definition, estimate flag,
 * the range of alternative sources and (if any) the derivation formula.
 */
import { convert, getCurrency, isStale, DEFAULT_MAX_AGE_MONTHS } from '../data';
import type { AltSource, SourcedValue } from '../data/types';
import { date, escapeHtml, money, number, percent, type Currency } from '../format';
import { t } from '../i18n';

const registry = new Map<string, { v: SourcedValue; label?: string }>();
let counter = 0;

export interface NumOptions {
  /** Override the displayed text (e.g. a derived figure). */
  text?: string;
  /** Show the value in this currency instead of the global one. */
  currency?: Currency;
  compact?: boolean;
  digits?: number;
  label?: string;
  /** Extra class on the wrapper. */
  cls?: string;
  /** Per-file default max age for the stale badge. */
  maxAge?: number;
}

export function formatValue(v: SourcedValue, opts: NumOptions = {}): string {
  if (opts.text) return opts.text;
  if (v.unit.startsWith('currency')) {
    const to = opts.currency ?? getCurrency();
    const amount = v.currency ? convert(v.value, v.currency, to) : v.value;
    return money(amount, to, { compact: opts.compact, digits: opts.digits });
  }
  if (v.unit === 'percent') return percent(v.value, opts.digits ?? 1);
  if (v.unit === 'grams') return `${number(v.value * 1000, 2)} mg`;
  if (v.unit === 'ratio') return number(v.value, opts.digits ?? 3);
  return number(v.value, opts.digits ?? 0);
}

export function num(v: SourcedValue, opts: NumOptions = {}): string {
  const id = `src-${++counter}`;
  registry.set(id, { v, label: opts.label });
  const stale = isStale(v, opts.maxAge ?? DEFAULT_MAX_AGE_MONTHS);
  const est = v.is_estimate ? `<abbr class="est" title="${escapeHtml(t('common.estimate'))}">≈</abbr>` : '';
  const staleBadge = stale ? `<span class="stale-badge" title="${escapeHtml(t('common.staleTitle', { date: v.as_of ?? v.retrieved_at }))}">${escapeHtml(t('common.staleShort'))}</span>` : '';
  return `<span class="num ${opts.cls ?? ''}">${est}<span class="num-value">${escapeHtml(formatValue(v, opts))}</span><button type="button" class="src-btn" data-src="${id}" aria-expanded="false" aria-label="${escapeHtml(t('common.showSource'))}">i</button>${staleBadge}</span>`;
}

function altRange(v: SourcedValue): string {
  const alts: AltSource[] = v.alt_sources ?? [];
  if (!alts.length) return '';
  const to = getCurrency();
  const all = [{ value: v.value, currency: v.currency, source: v.source, as_of: v.as_of, source_url: v.source_url, notes: undefined as string | undefined }, ...alts];
  const conv = all.map((a) => (a.currency ? convert(a.value, a.currency, to) : a.value));
  const lo = Math.min(...conv);
  const hi = Math.max(...conv);
  const rows = all
    .map((a, i) => `<li><a href="${escapeHtml(a.source_url)}" target="_blank" rel="noopener">${escapeHtml(a.source)}</a>${a.as_of ? ` (${escapeHtml(a.as_of)})` : ''}: <strong>${escapeHtml(v.unit.startsWith('currency') ? money(conv[i], to) : number(conv[i]))}</strong>${a.notes ? ` <em>${escapeHtml(a.notes)}</em>` : ''}</li>`)
    .join('');
  return `<p class="src-range"><strong>${escapeHtml(t('common.range'))}:</strong> ${escapeHtml(v.unit.startsWith('currency') ? `${money(lo, to)} – ${money(hi, to)}` : `${number(lo)} – ${number(hi)}`)}</p><ul class="src-alts">${rows}</ul>`;
}

export function renderPopover(id: string): string {
  const entry = registry.get(id);
  if (!entry) return '';
  const { v, label } = entry;
  const stale = isStale(v);
  return `
    <div class="src-pop-inner">
      <h4>${escapeHtml(label ?? t('common.source'))}</h4>
      ${v.is_estimate ? `<p class="src-est">${escapeHtml(t('common.estimateLong'))}${v.estimate_by ? ` (${escapeHtml(v.estimate_by)})` : ''}</p>` : ''}
      ${stale ? `<p class="src-stale">${escapeHtml(t('common.staleTitle', { date: v.as_of ?? v.retrieved_at }))}</p>` : ''}
      <dl>
        <dt>${escapeHtml(t('common.source'))}</dt><dd><a href="${escapeHtml(v.source_url)}" target="_blank" rel="noopener">${escapeHtml(v.source)}</a></dd>
        ${v.as_of ? `<dt>${escapeHtml(t('common.asOf'))}</dt><dd>${escapeHtml(v.as_of)}</dd>` : ''}
        <dt>${escapeHtml(t('common.retrieved'))}</dt><dd>${escapeHtml(date(v.retrieved_at))}</dd>
        <dt>${escapeHtml(t('common.definition'))}</dt><dd>${escapeHtml(v.definition)}</dd>
        ${v.derived ? `<dt>${escapeHtml(t('common.derivedFormula'))}</dt><dd><code>${escapeHtml(v.derived.formula)}</code></dd>` : ''}
        ${v.notes ? `<dt>${escapeHtml(t('common.notes'))}</dt><dd>${escapeHtml(v.notes)}</dd>` : ''}
        ${v.currency && v.currency !== getCurrency() ? `<dt>${escapeHtml(t('common.converted'))}</dt><dd>${escapeHtml(t('common.convertedNote', { original: money(v.value, v.currency, { compact: Math.abs(v.value) >= 1e6 }), currency: v.currency }))}</dd>` : ''}
      </dl>
      ${altRange(v)}
    </div>`;
}

/** One popover element for the whole page; opened by delegation. */
export function installSourcePopovers(root: HTMLElement): void {
  let pop = document.getElementById('src-pop') as HTMLDivElement | null;
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'src-pop';
    pop.className = 'src-pop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    document.body.appendChild(pop);
  }
  let openBtn: HTMLButtonElement | null = null;

  const close = () => {
    if (!pop) return;
    pop.hidden = true;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.focus();
      openBtn = null;
    }
  };

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.src-btn');
    if (!btn || !pop) return;
    e.preventDefault();
    if (openBtn === btn) {
      close();
      return;
    }
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.innerHTML = `<button type="button" class="src-close" aria-label="${escapeHtml(t('common.close'))}">×</button>${renderPopover(btn.dataset.src!)}`;
    pop.hidden = false;
    const r = btn.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    let left = r.left + window.scrollX;
    if (left + width > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - width - 12;
    pop.style.width = `${width}px`;
    pop.style.left = `${Math.max(12, left)}px`;
    pop.style.top = `${r.bottom + window.scrollY + 6}px`;
    (pop.querySelector('.src-close') as HTMLButtonElement).focus();
  });
  document.addEventListener('click', (e) => {
    if (!pop || pop.hidden) return;
    const target = e.target as HTMLElement;
    if (target.closest('.src-close')) {
      close();
      return;
    }
    if (!pop.contains(target) && !target.closest('.src-btn')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop && !pop.hidden) close();
  });
}
