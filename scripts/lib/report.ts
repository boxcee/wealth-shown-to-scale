import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './io.js';
import type { ReviewItem } from './plausibility.js';
import type { StaleItem } from './staleness.js';
import type { ChangeEntry } from './changelog.js';

export interface PipelineReport {
  date: string;
  dryRun: boolean;
  threshold: number;
  fetchers: { name: string; status: 'ok' | 'failed' | 'skipped'; message?: string }[];
  changes: ChangeEntry[];
  review: ReviewItem[];
  stale: StaleItem[];
  validation: { file: string; ok: boolean; errors: string[] }[];
}

export const REPORT_DIR = resolve(ROOT, '.pipeline');
export const REPORT_PATH = resolve(REPORT_DIR, 'report.json');
export const ISSUE_PATH = resolve(REPORT_DIR, 'issue.md');

export function writeReport(report: PipelineReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(ISSUE_PATH, renderIssue(report));
}

/** Markdown body for the GitHub issue the workflow opens when something needs a human. */
export function renderIssue(r: PipelineReport): string {
  const lines: string[] = [];
  lines.push(`Automated data check of ${r.date}. This issue lists everything the pipeline did **not** change on its own.`);
  lines.push('');
  const failed = r.fetchers.filter((f) => f.status === 'failed');
  if (failed.length) {
    lines.push('## Fetchers that failed');
    lines.push('');
    for (const f of failed) lines.push(`- **${f.name}**: ${f.message ?? 'unknown error'} — last known good values were kept.`);
    lines.push('');
  }
  if (r.review.length) {
    lines.push(`## Values outside the plausibility threshold (${Math.round(r.threshold * 100)} %)`);
    lines.push('');
    lines.push('These were fetched but **not written**. Check the source and, if the new value is right, edit the data file by hand (or raise the threshold for that run).');
    lines.push('');
    lines.push('| File | Entry | Last known good | Fetched | Reason | Source |');
    lines.push('|---|---|---:|---:|---|---|');
    for (const item of r.review) {
      const cur = item.currency ? ` ${item.currency}` : '';
      lines.push(`| \`${item.file}\` | ${item.label} | ${item.oldValue ?? '—'}${cur} | ${item.newValue}${cur} | ${item.reason} | [${item.source}](${item.source_url}) |`);
    }
    lines.push('');
  }
  if (r.stale.length) {
    lines.push('## Entries older than their maximum age');
    lines.push('');
    lines.push('These are maintained by hand. Find the newest figure at the hinted location, update `value`, `as_of`, `retrieved_at` (and `source_url` if it moved).');
    lines.push('');
    lines.push('| File | Entry | Reference period | Age (months) | Max | Where to look |');
    lines.push('|---|---|---|---:|---:|---|');
    for (const s of r.stale) {
      lines.push(`| \`${s.file}\` | \`${s.key}\` | ${s.as_of} | ${s.ageMonths} | ${s.maxAgeMonths} | ${s.refresh_hint || s.source_url} |`);
    }
    lines.push('');
  }
  const invalid = r.validation.filter((v) => !v.ok);
  if (invalid.length) {
    lines.push('## Schema validation errors');
    lines.push('');
    for (const v of invalid) {
      lines.push(`- \`${v.file}\``);
      for (const e of v.errors) lines.push(`  - ${e}`);
    }
    lines.push('');
  }
  if (!failed.length && !r.review.length && !r.stale.length && !invalid.length) {
    lines.push('Nothing to review: all fetchers succeeded, all values passed the plausibility check, nothing is stale.');
  }
  return lines.join('\n') + '\n';
}

export function needsHuman(r: PipelineReport): boolean {
  return r.fetchers.some((f) => f.status === 'failed') || r.review.length > 0 || r.stale.length > 0 || r.validation.some((v) => !v.ok);
}
