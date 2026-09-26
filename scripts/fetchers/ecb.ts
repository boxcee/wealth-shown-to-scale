import { fetchText } from '../lib/http.js';
import { applyKeyedValue, loadKeyed, saveKeyed, type PipelineContext } from '../lib/context.js';

export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const FILE = 'exchange_rates.json';

export interface EcbRates {
  date: string;
  rates: Record<string, number>;
}

/** Parses the ECB daily reference-rate XML (no XML library needed for this fixed format). */
export function parseEcbXml(xml: string): EcbRates {
  const date = xml.match(/<Cube time='(\d{4}-\d{2}-\d{2})'>/)?.[1];
  if (!date) throw new Error('ECB XML: no date found');
  const rates: Record<string, number> = {};
  for (const m of xml.matchAll(/<Cube currency='([A-Z]{3})' rate='([\d.]+)'\/>/g)) {
    rates[m[1]] = Number(m[2]);
  }
  if (!rates.USD) throw new Error('ECB XML: no USD rate found');
  return { date, rates };
}

export async function runEcb(ctx: PipelineContext): Promise<void> {
  const xml = await fetchText(ECB_URL, { fixture: ctx.offline ? 'ecb-daily.xml' : undefined });
  const { date, rates } = parseEcbXml(xml);
  const doc = loadKeyed(FILE, 'Exchange rates', 'Euro foreign exchange reference rates published by the European Central Bank (one rate per working day, around 16:00 CET).', 2, 'scripts/fetchers/ecb.ts');
  applyKeyedValue(ctx, FILE, doc, 'usd_per_eur', 'USD per EUR (ECB reference rate)', {
    value: rates.USD,
    unit: 'ratio',
    currency: null,
    source: `European Central Bank, euro foreign exchange reference rates, ${date}`,
    source_url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    retrieved_at: ctx.today,
    as_of: date,
    definition: 'US dollars per one euro, ECB daily reference rate (mid-rate based on the daily concertation procedure between central banks). Used to convert all USD figures on this site into EUR and vice versa.',
    is_estimate: false,
    auto: true,
    max_age_months: 2,
    refresh_hint: ECB_URL,
  });
  saveKeyed(ctx, FILE, doc);
}
