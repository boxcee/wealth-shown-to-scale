import { dataPath, readJsonIfExists, writeJson } from './io.js';
import { checkDelta, type ReviewItem } from './plausibility.js';
import type { ChangeEntry } from './changelog.js';
import type { KeyedFile, SourcedValue } from './types.js';

export interface PipelineContext {
  today: string;
  dryRun: boolean;
  offline: boolean;
  threshold: number;
  changes: ChangeEntry[];
  review: ReviewItem[];
  log: (msg: string) => void;
}

/** Load a keyed data file, or an empty skeleton when it does not exist yet. */
export function loadKeyed(file: string, title: string, description: string, defaultMaxAge: number, pipeline: string): KeyedFile {
  return (
    readJsonIfExists<KeyedFile>(dataPath(file)) ?? {
      meta: { title, description, updated_at: '1970-01-01', default_max_age_months: defaultMaxAge, pipeline },
      values: {},
    }
  );
}

/**
 * Apply a freshly fetched value to a keyed file, honouring the plausibility gate.
 * Returns true when the value was accepted (written or would be written in dry-run).
 */
export function applyKeyedValue(ctx: PipelineContext, file: string, doc: KeyedFile, key: string, label: string, candidate: SourcedValue): boolean {
  const previous = doc.values[key];
  const check = checkDelta(previous?.value ?? null, candidate.value, ctx.threshold);
  if (!check.ok) {
    ctx.review.push({
      file,
      key,
      label,
      oldValue: previous?.value ?? null,
      newValue: candidate.value,
      currency: candidate.currency,
      reason: check.reason ?? 'plausibility check failed',
      source: candidate.source,
      source_url: candidate.source_url,
    });
    ctx.log(`  ! ${file} ${key}: kept last known good (${check.reason})`);
    return false;
  }
  const changed = !previous || previous.value !== candidate.value || previous.as_of !== candidate.as_of;
  // Preserve manually curated fields that a fetcher does not know about.
  const merged: SourcedValue = { ...previous, ...candidate };
  if (previous?.alt_sources && !candidate.alt_sources) merged.alt_sources = previous.alt_sources;
  doc.values[key] = merged;
  if (changed) {
    ctx.changes.push({ file, key, label, oldValue: previous?.value ?? null, newValue: candidate.value, currency: candidate.currency, source: candidate.source });
    ctx.log(`  ✓ ${file} ${key}: ${previous?.value ?? '—'} → ${candidate.value} (${candidate.as_of ?? ''})`);
  } else {
    ctx.log(`  = ${file} ${key}: unchanged (${candidate.value})`);
  }
  return true;
}

export function saveKeyed(ctx: PipelineContext, file: string, doc: KeyedFile): void {
  doc.meta.updated_at = ctx.today;
  if (ctx.dryRun) {
    ctx.log(`  (dry-run) would write ${file}`);
    return;
  }
  writeJson(dataPath(file), doc);
}
