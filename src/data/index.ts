import type { AllData, SourcedValue } from './types';
import type { Currency } from '../format';

const FILES: (keyof AllData)[] = ['exchange_rates', 'inflation', 'reference', 'distribution', 'rice', 'wealth_world', 'wealth_germany', 'prices', 'taxes', 'credits'];

let data: AllData | null = null;

/** Loads every data file once (same-origin JSON, the only network requests the site makes). */
export async function loadData(): Promise<AllData> {
  if (data) return data;
  const base = import.meta.env.BASE_URL;
  const entries = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`${base}data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load data/${name}.json (${res.status})`);
      return [name, await res.json()] as const;
    }),
  );
  let overrides = {};
  try {
    const res = await fetch(`${base}data/overrides/wealth_alt_sources.json`, { cache: 'no-cache' });
    if (res.ok) overrides = await res.json();
  } catch {
    /* optional */
  }
  data = Object.fromEntries([...entries, ['overrides', overrides]]) as unknown as AllData;
  // Give every sourced value the file-level default max age so the stale badge
  // agrees with the pipeline's staleness check.
  for (const [name, file] of Object.entries(data)) {
    if (name === 'overrides' || !file || typeof file !== 'object' || !('meta' in file)) continue;
    const def = (file as { meta: { default_max_age_months?: number } }).meta.default_max_age_months ?? DEFAULT_MAX_AGE_MONTHS;
    applyDefaultMaxAge(file, def);
  }
  return data;
}

export function getData(): AllData {
  if (!data) throw new Error('Data not loaded');
  return data;
}

function applyDefaultMaxAge(node: unknown, def: number): void {
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if ('value' in o && 'source' in o && 'retrieved_at' in o) {
    if (o.max_age_months === undefined) o.max_age_months = def;
    return;
  }
  for (const v of Object.values(o)) applyDefaultMaxAge(v, def);
}

// ---- currency state ---------------------------------------------------------

const CURRENCY_KEY = 'wsts.currency';
let currency: Currency = 'EUR';

export function getCurrency(): Currency {
  return currency;
}

export function setCurrency(c: Currency): void {
  currency = c;
  try {
    localStorage.setItem(CURRENCY_KEY, c);
  } catch {
    /* private mode */
  }
}

export function initCurrency(fromUrl: string | null): Currency {
  if (fromUrl === 'USD' || fromUrl === 'EUR') {
    setCurrency(fromUrl);
    return currency;
  }
  try {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored === 'USD' || stored === 'EUR') currency = stored;
  } catch {
    /* ignore */
  }
  return currency;
}

/** USD per EUR from the ECB file. */
export function usdPerEur(): number {
  return getData().exchange_rates.values.usd_per_eur.value;
}

/** Convert an amount between USD and EUR using the ECB reference rate. */
export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  const rate = usdPerEur();
  return from === 'USD' ? amount / rate : amount * rate;
}

/** Value of a monetary entry in the current display currency. */
export function inDisplay(v: SourcedValue, to: Currency = currency): number {
  if (!v.currency) return v.value;
  return convert(v.value, v.currency, to);
}

// ---- staleness --------------------------------------------------------------

export const DEFAULT_MAX_AGE_MONTHS = 18;

export function ageMonths(v: SourcedValue, now = new Date()): number {
  const ref = v.as_of ?? v.retrieved_at;
  const years = ref.match(/\d{4}/g);
  if (!years) return 0;
  const year = Number(years[years.length - 1]);
  const rest = ref.slice(ref.lastIndexOf(String(year)) + 4);
  const month = rest.match(/^-(\d{2})/) ? Number(rest.slice(1, 3)) : 12;
  const refDate = new Date(Date.UTC(year, month - 1, 15));
  return (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function isStale(v: SourcedValue, fileDefault = DEFAULT_MAX_AGE_MONTHS): boolean {
  return ageMonths(v) > (v.max_age_months ?? fileDefault);
}

// ---- inflation --------------------------------------------------------------

/** Rebase a price from its price year to the latest CPI year of its currency. Returns null if impossible. */
export function inflate(amount: number, cur: Currency, fromYear: number): { value: number; toYear: number } | null {
  const series = cur === 'EUR' ? getData().inflation.values.de_hicp_annual?.series : getData().inflation.values.us_cpi_u_annual?.series;
  if (!series) return null;
  const years = Object.keys(series).sort();
  const toYear = Number(years[years.length - 1]);
  const from = series[String(fromYear)];
  const to = series[String(toYear)];
  if (!from || !to || fromYear >= toYear) return null;
  return { value: (amount * to) / from, toYear };
}
