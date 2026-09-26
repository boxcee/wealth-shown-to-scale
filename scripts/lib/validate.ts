import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJson, SCHEMA_DIR } from './io.js';

/** Which schema validates which data file. */
export const FILE_SCHEMAS: Record<string, string> = {
  'exchange_rates.json': 'keyed.schema.json',
  'inflation.json': 'keyed.schema.json',
  'reference.json': 'keyed.schema.json',
  'distribution.json': 'keyed.schema.json',
  'rice.json': 'keyed.schema.json',
  'wealth_world.json': 'wealth.schema.json',
  'wealth_germany.json': 'wealth.schema.json',
  'prices.json': 'prices.schema.json',
  'taxes.json': 'taxes.schema.json',
  'credits.json': 'credits.schema.json',
};

let ajv: Ajv2020 | null = null;

export function getAjv(): Ajv2020 {
  if (ajv) return ajv;
  ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats.default ? addFormats.default(ajv) : (addFormats as unknown as (a: Ajv2020) => void)(ajv);
  for (const file of readdirSync(SCHEMA_DIR)) {
    if (file.endsWith('.schema.json')) {
      ajv.addSchema(readJson(resolve(SCHEMA_DIR, file)));
    }
  }
  return ajv;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateAgainst(schemaFile: string, data: unknown): ValidationResult {
  const a = getAjv();
  const validate = a.getSchema(`https://wealth-shown-to-scale/schema/${schemaFile}`);
  if (!validate) throw new Error(`Schema not registered: ${schemaFile}`);
  const ok = validate(data) as boolean;
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''} ${JSON.stringify(e.params)}`);
  return { ok, errors };
}

/** Extra semantic checks that JSON Schema cannot express. */
export function semanticChecks(file: string, data: unknown): string[] {
  const problems: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if ('value' in obj && 'unit' in obj && 'source' in obj) {
      const unit = obj.unit as string;
      const currency = obj.currency as string | null;
      if (unit.startsWith('currency') && !currency) problems.push(`${file}${path}: monetary value without currency`);
      if (!unit.startsWith('currency') && currency) problems.push(`${file}${path}: non-monetary value has a currency`);
      if (obj.is_estimate === true && !obj.estimate_by && !(obj.source as string).match(/estimate|Schätz|Forbes|Oxfam|model|derived/i)) {
        problems.push(`${file}${path}: is_estimate=true but estimate_by is missing`);
      }
      if (typeof obj.retrieved_at === 'string' && obj.retrieved_at > new Date().toISOString().slice(0, 10)) {
        problems.push(`${file}${path}: retrieved_at lies in the future`);
      }
      return;
    }
    for (const [k, v] of Object.entries(obj)) visit(v, `${path}/${k}`);
  };
  visit(data, '');
  return problems;
}
