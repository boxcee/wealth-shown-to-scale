import { fetchJson } from '../lib/http.js';
import { dataPath, readJsonIfExists, writeJson } from '../lib/io.js';
import { checkDelta } from '../lib/plausibility.js';
import type { PipelineContext } from '../lib/context.js';
import type { AltSource, Person, WealthFile } from '../lib/types.js';

export const FORBES_RT_URL =
  'https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?fields=uri,finalWorth,personName,countryOfCitizenship,source,rank,timestamp&limit=4000';
export const forbesAnnualUrl = (year: number) =>
  `https://www.forbes.com/forbesapi/person/billionaires/${year}/position/true.json?fields=uri,finalWorth,personName,countryOfCitizenship,rank&limit=4000`;

export const TOP_N = 10;

export interface ForbesPerson {
  uri: string;
  finalWorth: number; // millions USD
  personName: string;
  countryOfCitizenship: string;
  source?: string;
  rank: number;
  timestamp?: number;
}

interface ForbesResponse {
  personList: { personsLists: ForbesPerson[]; count?: number };
}

interface Overrides {
  /** Manual alternative sources per Forbes id (e.g. Manager Magazin). */
  alt_sources: Record<string, AltSource[]>;
  /** Number of named persons behind family entries, where a source states it. */
  persons_named: Record<string, number>;
  /** Persons in other lists but not in Forbes real-time (documented, informational). */
  missing_from_forbes?: { name: string; source: string; source_url: string; value: number; currency: string; as_of: string }[];
}

export function isFamily(name: string): boolean {
  return /&\s*family|family|familie/i.test(name);
}

export function pickTop(list: ForbesPerson[], n: number, country?: string): ForbesPerson[] {
  const filtered = country ? list.filter((p) => p.countryOfCitizenship === country) : list;
  return [...filtered].sort((a, b) => b.finalWorth - a.finalWorth).slice(0, n);
}

function toPerson(ctx: PipelineContext, p: ForbesPerson, rank: number, rtDate: string, annual: Map<string, { year: number; p: ForbesPerson }>, overrides: Overrides): Person {
  const alt: AltSource[] = [];
  const a = annual.get(p.uri);
  if (a) {
    alt.push({
      value: a.p.finalWorth * 1e6,
      currency: 'USD',
      source: `Forbes, The World's Billionaires ${a.year} (annual list, snapshot of early ${a.year})`,
      source_url: `https://www.forbes.com/profile/${p.uri}/`,
      retrieved_at: ctx.today,
      as_of: `${a.year}-03`,
      is_estimate: true,
    });
  }
  for (const manual of overrides.alt_sources[p.uri] ?? []) alt.push(manual);
  return {
    id: p.uri,
    name: p.personName,
    rank,
    country: p.countryOfCitizenship,
    source_of_wealth: p.source ?? '',
    profile_url: `https://www.forbes.com/profile/${p.uri}/`,
    is_family: isFamily(p.personName),
    persons_named: overrides.persons_named[p.uri] ?? null,
    wealth: {
      value: Math.round(p.finalWorth * 1e6),
      unit: 'currency',
      currency: 'USD',
      source: `Forbes Real-Time Billionaires, ${rtDate}`,
      source_url: `https://www.forbes.com/profile/${p.uri}/`,
      retrieved_at: ctx.today,
      as_of: rtDate,
      definition: 'Estimated net worth in US dollars according to Forbes (real-time list): publicly known stakes in listed companies valued at current share prices, private companies valued by Forbes using comparable listed firms, plus known other assets, minus known debts. Family entries pool the wealth of several relatives.',
      is_estimate: true,
      estimate_by: 'Forbes',
      auto: true,
      max_age_months: 2,
      refresh_hint: FORBES_RT_URL,
      alt_sources: alt,
    },
  };
}

/**
 * Merge a freshly built list with the last known good file:
 * - a person whose value moved more than the threshold keeps the old value (review item)
 * - manual alt_sources on the old entry are preserved
 */
export function mergeWealthFile(ctx: PipelineContext, file: string, previous: WealthFile | null, fresh: Person[]): WealthFile {
  const oldById = new Map((previous?.people ?? []).map((p) => [p.id, p]));
  const people: Person[] = fresh.map((p) => {
    const old = oldById.get(p.id);
    const check = checkDelta(old?.wealth.value ?? null, p.wealth.value, ctx.threshold);
    if (!check.ok && old) {
      ctx.review.push({
        file,
        key: p.id,
        label: p.name,
        oldValue: old.wealth.value,
        newValue: p.wealth.value,
        currency: 'USD',
        reason: check.reason ?? 'plausibility check failed',
        source: p.wealth.source,
        source_url: p.wealth.source_url,
      });
      ctx.log(`  ! ${file} ${p.id}: kept last known good (${check.reason})`);
      return { ...old, rank: p.rank };
    }
    if (!old || old.wealth.value !== p.wealth.value) {
      ctx.changes.push({ file, key: p.id, label: p.name, oldValue: old?.wealth.value ?? null, newValue: p.wealth.value, currency: 'USD', source: p.wealth.source });
      ctx.log(`  ✓ ${file} ${p.id}: ${old?.wealth.value ?? '—'} → ${p.wealth.value}`);
    }
    // keep manual alt sources that are not Forbes-generated if the override file lost them
    const manualOld = (old?.wealth.alt_sources ?? []).filter((a) => !a.source.startsWith('Forbes'));
    const seen = new Set((p.wealth.alt_sources ?? []).map((a) => a.source_url + a.value));
    for (const m of manualOld) if (!seen.has(m.source_url + m.value)) p.wealth.alt_sources!.push(m);
    return p;
  });
  return {
    meta: previous?.meta
      ? { ...previous.meta, updated_at: ctx.today }
      : { title: file, updated_at: ctx.today, default_max_age_months: 2, pipeline: 'scripts/fetchers/forbes.ts' },
    people,
  };
}

export async function runForbes(ctx: PipelineContext): Promise<void> {
  const rt = await fetchJson<ForbesResponse>(FORBES_RT_URL, { fixture: ctx.offline ? 'forbes-rt.json' : undefined });
  const list = rt.personList.personsLists;
  if (!list?.length) throw new Error('Forbes: empty real-time list');
  const ts = list[0].timestamp ? new Date(list[0].timestamp).toISOString().slice(0, 10) : ctx.today;

  // Annual list as an alternative source (try current year, then previous).
  const annual = new Map<string, { year: number; p: ForbesPerson }>();
  const year = Number(ctx.today.slice(0, 4));
  for (const y of [year, year - 1]) {
    try {
      const a = await fetchJson<ForbesResponse>(forbesAnnualUrl(y), { fixture: ctx.offline ? 'forbes-annual.json' : undefined, retries: 1 });
      if (a.personList?.personsLists?.length) {
        for (const p of a.personList.personsLists) annual.set(p.uri, { year: y, p });
        break;
      }
    } catch (err) {
      ctx.log(`  annual list ${y} unavailable: ${(err as Error).message}`);
    }
  }

  const overrides = readJsonIfExists<Overrides>(dataPath('overrides/wealth_alt_sources.json')) ?? { alt_sources: {}, persons_named: {} };

  const world = pickTop(list, TOP_N).map((p, i) => toPerson(ctx, p, i + 1, ts, annual, overrides));
  const germany = pickTop(list, TOP_N, 'Germany').map((p, i) => toPerson(ctx, p, i + 1, ts, annual, overrides));
  if (germany.length < TOP_N) throw new Error(`Forbes: only ${germany.length} German entries found`);

  for (const [file, fresh, title, desc] of [
    ['wealth_world.json', world, 'Top 10 richest people worldwide', 'The ten largest fortunes in the Forbes Real-Time Billionaires list, refreshed monthly. Alternative sources (Forbes annual list, Manager Magazin for Germans) are stored per person so the UI can show the range.'],
    ['wealth_germany.json', germany, 'Top 10 richest Germans', 'The ten largest fortunes with German citizenship in the Forbes Real-Time Billionaires list (Forbes citizenship field). Family entries are flagged. Manager Magazin figures are attached as alternative sources where available.'],
  ] as const) {
    const previous = readJsonIfExists<WealthFile>(dataPath(file));
    const merged = mergeWealthFile(ctx, file, previous, [...fresh]);
    if (!previous) merged.meta = { title, description: desc, updated_at: ctx.today, default_max_age_months: 2, pipeline: 'scripts/fetchers/forbes.ts' };
    if (ctx.dryRun) ctx.log(`  (dry-run) would write ${file}`);
    else writeJson(dataPath(file), merged);
  }
}
