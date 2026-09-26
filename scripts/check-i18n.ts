/**
 * i18n CI check: every locale must have exactly the key set of the default language,
 * and placeholders ({name}) must match per key. Exit 1 on any difference.
 */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, readJson } from './lib/io.js';

const LOCALES_DIR = resolve(ROOT, 'src', 'i18n', 'locales');
const DEFAULT = 'en';

type Tree = Record<string, unknown>;

export function flatten(obj: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'string') out.set(`${key}[${i}]`, item);
        else for (const [ik, iv] of flatten(item as Tree, `${key}[${i}]`)) out.set(ik, iv);
      });
    } else if (v && typeof v === 'object') {
      for (const [ik, iv] of flatten(v as Tree, key)) out.set(ik, iv);
    } else {
      out.set(key, String(v));
    }
  }
  return out;
}

export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

export interface Diff {
  locale: string;
  missing: string[];
  extra: string[];
  placeholderMismatch: string[];
}

export function compare(base: Map<string, string>, other: Map<string, string>, locale: string): Diff {
  const missing = [...base.keys()].filter((k) => !other.has(k));
  const extra = [...other.keys()].filter((k) => !base.has(k));
  const placeholderMismatch = [...base.keys()].filter((k) => other.has(k) && placeholders(base.get(k)!).join(',') !== placeholders(other.get(k)!).join(','));
  return { locale, missing, extra, placeholderMismatch };
}

export function checkLocales(dir = LOCALES_DIR): Diff[] {
  const base = flatten(readJson<Tree>(resolve(dir, `${DEFAULT}.json`)));
  const diffs: Diff[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== `${DEFAULT}.json`)) {
    diffs.push(compare(base, flatten(readJson<Tree>(resolve(dir, f))), f.replace('.json', '')));
  }
  return diffs;
}

if (process.argv[1] && /check-i18n\.ts$/.test(process.argv[1])) {
  // Also make sure every language in the registry has a file.
  const registry = await import('../src/i18n/languages.ts');
  let failed = false;
  for (const lang of registry.LANGUAGES) {
    if (!readdirSync(LOCALES_DIR).includes(`${lang.code}.json`)) {
      console.error(`✗ locale file missing for registered language "${lang.code}"`);
      failed = true;
    }
  }
  for (const d of checkLocales()) {
    const ok = !d.missing.length && !d.extra.length && !d.placeholderMismatch.length;
    console.log(`${ok ? '✓' : '✗'} ${d.locale}: ${d.missing.length} missing, ${d.extra.length} extra, ${d.placeholderMismatch.length} placeholder mismatches`);
    for (const k of d.missing) console.log(`    missing: ${k}`);
    for (const k of d.extra) console.log(`    extra:   ${k}`);
    for (const k of d.placeholderMismatch) console.log(`    placeholders differ: ${k}`);
    if (!ok) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
