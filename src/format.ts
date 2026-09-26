import { currentLanguage, t } from './i18n';

export type Currency = 'USD' | 'EUR';

function locale(): string {
  return currentLanguage().locale;
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale() + JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), options);
    fmtCache.set(key, f);
  }
  return f;
}

/** "€1.5B" / "1,5 Mrd. €" */
export function money(value: number, currency: Currency, opts: { compact?: boolean; digits?: number } = {}): string {
  const compact = opts.compact ?? Math.abs(value) >= 1_000_000;
  return nf({
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.digits ?? (compact ? 1 : 0),
    minimumFractionDigits: 0,
  }).format(value);
}

/** Full precision money, e.g. "€929,000,000,000" */
export function moneyExact(value: number, currency: Currency): string {
  return nf({ style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function number(value: number, digits = 0): string {
  return nf({ maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

export function compactNumber(value: number, digits = 1): string {
  return nf({ notation: 'compact', maximumFractionDigits: digits }).format(value);
}

export function percent(value: number, digits = 1): string {
  return nf({ style: 'percent', maximumFractionDigits: digits }).format(value / 100);
}

export function ratio(value: number, digits = 0): string {
  return t('common.times', { n: number(value, digits) });
}

export function date(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 1) return iso;
  const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1] ?? 1) - 1, Number(parts[2] ?? 1)));
  const opts: Intl.DateTimeFormatOptions = parts.length === 3 ? { year: 'numeric', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long' };
  return new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(d);
}

export function years(value: number): string {
  return t('common.years', { count: Math.round(value), n: number(value, value < 10 ? 1 : 0) });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
