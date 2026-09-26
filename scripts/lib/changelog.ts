import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './io.js';

export interface ChangeEntry {
  file: string;
  key: string;
  label: string;
  oldValue: number | null;
  newValue: number;
  currency: string | null;
  source: string;
}

const HEADER = `# Data changelog

Every value the monthly pipeline changed, newest first. Manual edits to \`data/*.json\` are recorded in git history.
Values that failed the plausibility check are **not** listed here; they are opened as an issue instead.
`;

export function formatChange(c: ChangeEntry): string {
  const fmt = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 4 }));
  const cur = c.currency ? ` ${c.currency}` : '';
  return `- \`${c.file}\` · ${c.label}: ${fmt(c.oldValue)}${cur} → **${fmt(c.newValue)}${cur}** (${c.source})`;
}

export function appendChangelog(dateIso: string, changes: ChangeEntry[]): void {
  if (changes.length === 0) return;
  const path = resolve(ROOT, 'DATA-CHANGELOG.md');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : HEADER;
  const body = existing.startsWith('# Data changelog') ? existing.slice(existing.indexOf('\n## ') === -1 ? existing.length : existing.indexOf('\n## ')) : existing;
  const section = `\n## ${dateIso}\n\n${changes.map(formatChange).join('\n')}\n`;
  writeFileSync(path, HEADER + section + body, 'utf8');
}
