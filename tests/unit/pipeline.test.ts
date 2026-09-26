import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkDelta } from '../../scripts/lib/plausibility';
import { findStale } from '../../scripts/lib/staleness';
import { monthsBetween, parseLoose } from '../../scripts/lib/io';
import { parseEcbXml } from '../../scripts/fetchers/ecb';
import { parseBls, parseEurostat } from '../../scripts/fetchers/inflation';
import { isFamily, mergeWealthFile, pickTop, type ForbesPerson } from '../../scripts/fetchers/forbes';
import { compare, flatten, placeholders } from '../../scripts/check-i18n';
import { renderIssue, needsHuman, type PipelineReport } from '../../scripts/lib/report';
import type { PipelineContext } from '../../scripts/lib/context';
import type { Person, WealthFile } from '../../scripts/lib/types';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

describe('plausibility gate', () => {
  it('accepts the first value and small moves', () => {
    expect(checkDelta(null, 5, 0.4).ok).toBe(true);
    expect(checkDelta(100, 130, 0.4).ok).toBe(true);
  });
  it('rejects moves beyond the threshold and non-numbers', () => {
    expect(checkDelta(100, 150, 0.4).ok).toBe(false);
    expect(checkDelta(100, 40, 0.4).ok).toBe(false);
    expect(checkDelta(100, NaN, 0.4).ok).toBe(false);
  });
});

describe('staleness', () => {
  it('parses loose periods', () => {
    expect(parseLoose('2023').getUTCFullYear()).toBe(2023);
    expect(parseLoose('2025-04').getUTCMonth()).toBe(3);
    expect(Math.round(monthsBetween('2024-12', '2026-09-26'))).toBe(21);
  });
  it('flags entries older than their max age, using the file default otherwise', () => {
    const data = { meta: { default_max_age_months: 12 }, values: { fresh: { value: 1, source: 's', retrieved_at: '2026-09-01', as_of: '2026-08', source_url: 'https://x' }, old: { value: 1, source: 's', retrieved_at: '2026-09-01', as_of: '2022', source_url: 'https://x', max_age_months: 40 }, defaulted: { value: 1, source: 's', retrieved_at: '2025-01-01', source_url: 'https://x' } } };
    const stale = findStale('t.json', data, '2026-09-26');
    expect(stale.map((s) => s.key)).toEqual(['values/old', 'values/defaulted']);
  });
});

describe('fetch parsers', () => {
  it('parses the ECB daily XML', () => {
    const r = parseEcbXml(fixture('ecb-daily.xml'));
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.rates.USD).toBeGreaterThan(0.5);
    expect(r.rates.USD).toBeLessThan(2);
  });
  it('parses Eurostat JSON-stat', () => {
    const s = parseEurostat(JSON.parse(fixture('eurostat-hicp-de.json')));
    expect(Object.keys(s).length).toBeGreaterThan(5);
    expect(s['2015']).toBeCloseTo(100, 0);
  });
  it('parses BLS monthly data into annual averages, tolerating one unpublished month', () => {
    const p = parseBls(JSON.parse(fixture('bls-cpi-u.json')));
    expect(p.annual['2024']).toBeCloseTo(313.689, 2);
    expect(p.annual['2025']).toBeGreaterThan(p.annual['2024']);
    expect(p.annual['2026']).toBeUndefined();
  });
});

function ctx(): PipelineContext {
  return { today: '2026-09-26', dryRun: true, offline: true, threshold: 0.4, changes: [], review: [], log: () => {} };
}

describe('Forbes fetcher', () => {
  const list: ForbesPerson[] = JSON.parse(fixture('forbes-rt.json')).personList.personsLists;
  it('detects family entries', () => {
    expect(isFamily('Rob Walton & family')).toBe(true);
    expect(isFamily('Dieter Schwarz')).toBe(false);
  });
  it('picks the top N overall and per country by worth', () => {
    const top = pickTop(list, 10);
    expect(top).toHaveLength(10);
    expect(top[0].finalWorth).toBeGreaterThanOrEqual(top[9].finalWorth);
    const de = pickTop(list, 10, 'Germany');
    expect(de).toHaveLength(10);
    expect(de.every((p) => p.countryOfCitizenship === 'Germany')).toBe(true);
  });
  it('keeps last known good when a person jumps more than the threshold and preserves manual alt sources', () => {
    const c = ctx();
    const person = (value: number): Person => ({ id: 'x', name: 'X', rank: 1, country: 'Germany', source_of_wealth: 'y', is_family: false, persons_named: null, wealth: { value, unit: 'currency', currency: 'USD', source: 'Forbes Real-Time Billionaires, 2026-09-26', source_url: 'https://forbes', retrieved_at: '2026-09-26', definition: 'd', is_estimate: true, alt_sources: [] } });
    const previous: WealthFile = { meta: { title: 't', updated_at: '2026-08-01', default_max_age_months: 2 }, people: [{ ...person(100e9), wealth: { ...person(100e9).wealth, alt_sources: [{ value: 90e9, currency: 'EUR', source: 'Manager Magazin', source_url: 'https://mm', retrieved_at: '2026-08-01' }] } }] };
    const merged = mergeWealthFile(c, 'wealth_germany.json', previous, [person(200e9)]);
    expect(merged.people[0].wealth.value).toBe(100e9);
    expect(c.review).toHaveLength(1);
    expect(c.changes).toHaveLength(0);
    const c2 = ctx();
    const merged2 = mergeWealthFile(c2, 'wealth_germany.json', previous, [person(110e9)]);
    expect(merged2.people[0].wealth.value).toBe(110e9);
    expect(merged2.people[0].wealth.alt_sources?.some((a) => a.source === 'Manager Magazin')).toBe(true);
    expect(c2.changes).toHaveLength(1);
  });
});

describe('i18n check', () => {
  it('flattens nested objects and arrays and compares key sets and placeholders', () => {
    const base = flatten({ a: { b: 'x {n}', c: ['p', 'q'] }, d: { one: '1', other: '{count}' } });
    expect([...base.keys()]).toEqual(['a.b', 'a.c[0]', 'a.c[1]', 'd.one', 'd.other']);
    const other = flatten({ a: { b: 'y {m}', c: ['p', 'q'] }, d: { one: '1', other: '{count}' }, e: 'extra' });
    const diff = compare(base, other, 'xx');
    expect(diff.extra).toEqual(['e']);
    expect(diff.placeholderMismatch).toEqual(['a.b']);
    expect(placeholders('{b} and {a}')).toEqual(['a', 'b']);
  });
});

describe('issue rendering', () => {
  it('says when nothing needs a human and lists review/stale items otherwise', () => {
    const empty: PipelineReport = { date: '2026-09-26', dryRun: false, threshold: 0.4, fetchers: [{ name: 'ECB', status: 'ok' }], changes: [], review: [], stale: [], validation: [{ file: 'x.json', ok: true, errors: [] }] };
    expect(needsHuman(empty)).toBe(false);
    expect(renderIssue(empty)).toMatch(/Nothing to review/);
    const busy: PipelineReport = { ...empty, review: [{ file: 'w.json', key: 'x', label: 'X', oldValue: 1, newValue: 2, currency: 'USD', reason: 'deviates', source: 'Forbes', source_url: 'https://f' }], stale: [{ file: 'r.json', key: 'values/y', as_of: '2022', ageMonths: 45, maxAgeMonths: 40, refresh_hint: 'look here', source_url: 'https://s' }] };
    expect(needsHuman(busy)).toBe(true);
    const md = renderIssue(busy);
    expect(md).toMatch(/plausibility threshold/);
    expect(md).toMatch(/look here/);
  });
});
