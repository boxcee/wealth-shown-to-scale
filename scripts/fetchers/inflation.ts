import { fetchJson } from '../lib/http.js';
import { applyKeyedValue, loadKeyed, saveKeyed, type PipelineContext } from '../lib/context.js';

const FILE = 'inflation.json';

export const EUROSTAT_URL =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind?geo=DE&coicop=CP00&unit=INX_A_AVG&lastTimePeriod=16';
export const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0';

interface JsonStat {
  updated?: string;
  value: Record<string, number>;
  dimension: { time: { category: { index: Record<string, number> } } };
}

/** Eurostat JSON-stat 2.0 → { year: index } */
export function parseEurostat(json: JsonStat): Record<string, number> {
  const idx = json.dimension.time.category.index;
  const out: Record<string, number> = {};
  for (const [year, i] of Object.entries(idx)) {
    const v = json.value[String(i)];
    if (typeof v === 'number') out[year] = v;
  }
  if (!Object.keys(out).length) throw new Error('Eurostat: empty HICP series');
  return out;
}

interface BlsResponse {
  status: string;
  Results?: { series: { seriesID: string; data: { year: string; period: string; value: string }[] }[] };
  message?: string[];
}

/** BLS monthly CPI-U → annual averages for complete years, plus the latest month. */
export function parseBls(json: BlsResponse): { annual: Record<string, number>; latest: { period: string; value: number } } {
  if (json.status !== 'REQUEST_SUCCEEDED' || !json.Results?.series?.length) {
    throw new Error(`BLS: ${json.status} ${(json.message ?? []).join('; ')}`);
  }
  const data = json.Results.series[0].data.filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period));
  const byYear = new Map<string, { months: number; values: number[] }>();
  for (const d of data) {
    const entry = byYear.get(d.year) ?? { months: 0, values: [] };
    entry.months += 1;
    const v = Number(d.value);
    // BLS marks unpublished months with "-" (e.g. October 2025, lapse in appropriations).
    if (Number.isFinite(v)) entry.values.push(v);
    byYear.set(d.year, entry);
  }
  const annual: Record<string, number> = {};
  for (const [year, { months, values }] of byYear) {
    // A year counts as complete when all 12 months exist; up to one unpublished month is tolerated
    // and the average is taken over the published months.
    if (months === 12 && values.length >= 11) annual[year] = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3));
  }
  const sorted = [...data].sort((a, b) => (a.year + a.period < b.year + b.period ? 1 : -1));
  const latest = sorted[0];
  return { annual, latest: { period: `${latest.year}-${latest.period.slice(1)}`, value: Number(latest.value) } };
}

export async function runInflation(ctx: PipelineContext): Promise<void> {
  const doc = loadKeyed(FILE, 'Consumer price indices', 'Annual average consumer price indices used to inflation-adjust prices: HICP for Germany (Eurostat, 2015 = 100) and CPI-U for the United States (BLS, 1982–84 = 100).', 14, 'scripts/fetchers/inflation.ts');
  const errors: string[] = [];

  try {
    const de = await fetchJson<JsonStat>(EUROSTAT_URL, { fixture: ctx.offline ? 'eurostat-hicp-de.json' : undefined });
    const deSeries = parseEurostat(de);
    const deYears = Object.keys(deSeries).sort();
    const deLatest = deYears[deYears.length - 1];
    applyKeyedValue(ctx, FILE, doc, 'de_hicp_annual', `Germany HICP annual average ${deLatest}`, {
      value: deSeries[deLatest],
      unit: 'index',
      currency: null,
      source: `Eurostat, HICP – annual data (prc_hicp_aind), Germany, all-items, annual average index (2015 = 100)${de.updated ? `, dataset updated ${de.updated.slice(0, 10)}` : ''}`,
      source_url: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table',
      retrieved_at: ctx.today,
      as_of: deLatest,
      definition: 'Harmonised Index of Consumer Prices for Germany, annual average, 2015 = 100. A euro price from year A is rebased to year B by multiplying with index(B) / index(A).',
      is_estimate: false,
      auto: true,
      max_age_months: 14,
      refresh_hint: EUROSTAT_URL,
      series: deSeries,
    });
  } catch (err) {
    errors.push(`Eurostat: ${(err as Error).message}`);
  }

  try {
    const thisYear = Number(ctx.today.slice(0, 4));
    // The BLS v2 API allows 25 unregistered queries per day per IP; set BLS_API_KEY for 500/day.
    const key = process.env.BLS_API_KEY ? `&registrationkey=${process.env.BLS_API_KEY}` : '';
    const us = await fetchJson<BlsResponse>(`${BLS_URL}?startyear=${thisYear - 9}&endyear=${thisYear}${key}`, {
      fixture: ctx.offline ? 'bls-cpi-u.json' : undefined,
      retries: 1,
    });
    const parsed = parseBls(us);
    const usYears = Object.keys(parsed.annual).sort();
    const usLatest = usYears[usYears.length - 1];
    applyKeyedValue(ctx, FILE, doc, 'us_cpi_u_annual', `US CPI-U annual average ${usLatest}`, {
      value: parsed.annual[usLatest],
      unit: 'index',
      currency: null,
      source: `U.S. Bureau of Labor Statistics, CPI-U all items, U.S. city average, not seasonally adjusted (series CUUR0000SA0), annual average of monthly values; latest month ${parsed.latest.period}: ${parsed.latest.value}`,
      source_url: 'https://www.bls.gov/cpi/',
      retrieved_at: ctx.today,
      as_of: usLatest,
      definition: 'Consumer Price Index for All Urban Consumers, 1982–84 = 100, annual average calculated from the published monthly values (October 2025 was never published because of the federal funding lapse; 2025 is the average of the other eleven months). A dollar price from year A is rebased to year B by multiplying with index(B) / index(A).',
      is_estimate: false,
      auto: true,
      max_age_months: 14,
      refresh_hint: BLS_URL,
      series: parsed.annual,
    });
  } catch (err) {
    errors.push(`BLS: ${(err as Error).message}`);
  }

  if (Object.keys(doc.values).length) saveKeyed(ctx, FILE, doc);
  if (errors.length) throw new Error(errors.join(' | '));
}
