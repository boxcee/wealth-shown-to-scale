/** Validates every data/*.json against its schema plus semantic checks. Exit 1 on any problem. */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIR, readJson } from './lib/io.js';
import { FILE_SCHEMAS, semanticChecks, validateAgainst } from './lib/validate.js';

let failed = false;
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
for (const [file, schema] of Object.entries(FILE_SCHEMAS)) {
  if (!files.includes(file)) {
    console.error(`✗ ${file} is missing (expected, validated by ${schema})`);
    failed = true;
    continue;
  }
  const data = readJson(resolve(DATA_DIR, file));
  const res = validateAgainst(schema, data);
  const problems = [...res.errors, ...semanticChecks(file, data)];
  if (problems.length) {
    failed = true;
    console.error(`✗ ${file}\n  ${problems.join('\n  ')}`);
  } else {
    console.log(`✓ ${file}`);
  }
}
for (const f of files) if (!FILE_SCHEMAS[f]) console.warn(`! ${f} has no schema mapping in scripts/lib/validate.ts`);
process.exit(failed ? 1 : 0);
