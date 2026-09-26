import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = resolve(ROOT, 'data');
export const SCHEMA_DIR = resolve(ROOT, 'schema');

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readJsonIfExists<T = unknown>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function dataPath(name: string): string {
  return resolve(DATA_DIR, name);
}

/** Months between two ISO dates (YYYY, YYYY-MM or YYYY-MM-DD), fractional. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = parseLoose(fromIso);
  const to = parseLoose(toIso);
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

/** Accepts "2023", "2023/2024", "2025-04", "2025-04-10". Uses the latest year mentioned. */
export function parseLoose(iso: string): Date {
  const years = iso.match(/\d{4}/g);
  if (!years) return new Date(NaN);
  const year = years[years.length - 1];
  const rest = iso.slice(iso.lastIndexOf(year) + 4);
  const m = rest.match(/^-(\d{2})/);
  const d = rest.match(/^-\d{2}-(\d{2})/);
  const month = m ? Number(m[1]) : 12;
  const day = d ? Number(d[1]) : m ? 15 : 31;
  return new Date(Date.UTC(Number(year), month - 1, day));
}
