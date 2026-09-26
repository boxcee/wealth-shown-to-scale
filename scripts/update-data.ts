/**
 * Monthly data pipeline.
 *
 *   npm run update-data            fetch, validate, write, append changelog
 *   npm run update-data -- --dry-run
 *   npm run update-data -- --offline   (uses tests/fixtures, for tests/CI without network)
 *   npm run update-data -- --threshold 0.4
 *
 * Exit code 0 = data files are valid (even if some fetchers failed: last known good is kept).
 * Exit code 1 = a data file is invalid after the run.
 * The report in .pipeline/ tells the GitHub workflow whether to open an issue.
 */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIR, readJson, today } from './lib/io.js';
import { FILE_SCHEMAS, semanticChecks, validateAgainst } from './lib/validate.js';
import { findStale } from './lib/staleness.js';
import { appendChangelog } from './lib/changelog.js';
import { needsHuman, writeReport, type PipelineReport } from './lib/report.js';
import type { PipelineContext } from './lib/context.js';
import { runEcb } from './fetchers/ecb.js';
import { runInflation } from './fetchers/inflation.js';
import { runForbes } from './fetchers/forbes.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function main(): Promise<number> {
  const ctx: PipelineContext = {
    today: today(),
    dryRun: process.argv.includes('--dry-run'),
    offline: process.argv.includes('--offline'),
    threshold: Number(arg('--threshold') ?? process.env.PLAUSIBILITY_THRESHOLD ?? 0.4),
    changes: [],
    review: [],
    log: (m) => console.log(m),
  };
  console.log(`Data pipeline ${ctx.today}${ctx.dryRun ? ' (dry-run)' : ''}${ctx.offline ? ' (offline fixtures)' : ''}, threshold ${ctx.threshold * 100} %`);

  const report: PipelineReport = { date: ctx.today, dryRun: ctx.dryRun, threshold: ctx.threshold, fetchers: [], changes: [], review: [], stale: [], validation: [] };

  const fetchers: [string, (c: PipelineContext) => Promise<void>][] = [
    ['ECB exchange rates', runEcb],
    ['Eurostat HICP + BLS CPI', runInflation],
    ['Forbes billionaires', runForbes],
  ];
  for (const [name, fn] of fetchers) {
    console.log(`\n▶ ${name}`);
    try {
      await fn(ctx);
      report.fetchers.push({ name, status: 'ok' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${name} failed: ${message} — keeping last known good`);
      report.fetchers.push({ name, status: 'failed', message });
    }
  }

  console.log('\n▶ Validation');
  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
    const schema = FILE_SCHEMAS[file];
    if (!schema) continue;
    const data = readJson(resolve(DATA_DIR, file));
    const res = validateAgainst(schema, data);
    const problems = [...res.errors, ...semanticChecks(file, data)];
    report.validation.push({ file, ok: problems.length === 0, errors: problems });
    console.log(`  ${problems.length === 0 ? '✓' : '✗'} ${file}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
    report.stale.push(...findStale(file, data, ctx.today));
  }

  report.changes = ctx.changes;
  report.review = ctx.review;
  if (!ctx.dryRun) appendChangelog(ctx.today, ctx.changes);
  writeReport(report);

  console.log(`\nChanged: ${ctx.changes.length}, needs review: ${ctx.review.length}, stale: ${report.stale.length}, human needed: ${needsHuman(report)}`);
  if (report.stale.length) for (const s of report.stale) console.log(`  stale: ${s.file} ${s.key} (${s.as_of}, ${s.ageMonths} > ${s.maxAgeMonths} months)`);
  return report.validation.every((v) => v.ok) ? 0 : 1;
}

if (process.argv[1] && /update-data\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
