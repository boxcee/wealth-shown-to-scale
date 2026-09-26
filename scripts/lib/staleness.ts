import { monthsBetween } from './io.js';

export interface StaleItem {
  file: string;
  key: string;
  as_of: string;
  ageMonths: number;
  maxAgeMonths: number;
  refresh_hint: string;
  source_url: string;
}

interface SourcedValue {
  as_of?: string;
  retrieved_at: string;
  max_age_months?: number;
  refresh_hint?: string;
  source_url: string;
  auto?: boolean;
}

/**
 * Walks a data file and returns every sourced value whose reference period
 * (as_of, else retrieved_at) is older than its max_age_months
 * (falling back to meta.default_max_age_months).
 */
export function findStale(file: string, data: unknown, todayIso: string): StaleItem[] {
  const out: StaleItem[] = [];
  const meta = (data as { meta?: { default_max_age_months?: number } }).meta ?? {};
  const defaultMax = meta.default_max_age_months ?? 18;
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if ('value' in obj && 'source' in obj && 'retrieved_at' in obj) {
      const v = obj as unknown as SourcedValue;
      const ref = v.as_of ?? v.retrieved_at;
      const age = monthsBetween(ref, todayIso);
      const max = v.max_age_months ?? defaultMax;
      if (Number.isFinite(age) && age > max) {
        out.push({
          file,
          key: path.replace(/^\//, ''),
          as_of: ref,
          ageMonths: Math.round(age),
          maxAgeMonths: max,
          refresh_hint: v.refresh_hint ?? '',
          source_url: v.source_url,
        });
      }
      return;
    }
    for (const [k, val] of Object.entries(obj)) visit(val, `${path}/${k}`);
  };
  visit(data, '');
  return out;
}
