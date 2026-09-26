export interface SourcedValue {
  value: number;
  unit: string;
  currency: 'USD' | 'EUR' | null;
  source: string;
  source_url: string;
  retrieved_at: string;
  as_of?: string;
  definition: string;
  is_estimate: boolean;
  estimate_by?: string;
  notes?: string;
  auto?: boolean;
  max_age_months?: number;
  refresh_hint?: string;
  derived?: { formula: string; inputs: string[] };
  series?: Record<string, number>;
  alt_sources?: AltSource[];
}

export interface AltSource {
  value: number;
  currency: 'USD' | 'EUR' | null;
  source: string;
  source_url: string;
  retrieved_at: string;
  as_of?: string;
  is_estimate?: boolean;
  notes?: string;
}

export interface FileMeta {
  title: string;
  description?: string;
  updated_at: string;
  default_max_age_months: number;
  pipeline?: string;
}

export interface KeyedFile {
  meta: FileMeta;
  values: Record<string, SourcedValue>;
}

export interface Person {
  id: string;
  name: string;
  rank: number;
  country: string;
  source_of_wealth: string;
  profile_url?: string;
  is_family: boolean;
  persons_named: number | null;
  wealth: SourcedValue;
}

export interface WealthFile {
  meta: FileMeta;
  people: Person[];
}

export interface PriceItem {
  id: string;
  category: 'consumer' | 'society' | 'climate' | 'global';
  icon?: string;
  price: SourcedValue;
  price_year: number;
  inflation_adjust: boolean;
  max_quantity: number;
}

export interface PricesFile {
  meta: FileMeta;
  items: PriceItem[];
}

export interface EffectiveRate {
  id: string;
  country: 'DE' | 'US' | 'WORLD' | 'FR';
  group: string;
  denominator: 'taxable_income' | 'economic_income' | 'wealth';
  includes_corporate_tax: boolean;
  numerator: string;
  period?: string;
  rate: SourcedValue;
  rate_low?: number;
  rate_high?: number;
  comparison_group?: string;
  comparison_rate?: number;
}

export interface TaxesFile {
  meta: FileMeta;
  nominal: Record<'DE' | 'US', Record<string, SourcedValue>>;
  effective: EffectiveRate[];
  parameters: Record<'DE' | 'US', Record<string, SourcedValue>>;
}

export interface CreditsFile {
  meta: FileMeta;
  originals: {
    id: string;
    title: string;
    author: string;
    url: string | null;
    url_status: 'ok' | 'offline' | 'unverified' | 'none';
    mirror_url: string | null;
    repo_url: string | null;
    link_checked_at: string;
    license: string;
    relationship: 'reimplementation' | 'inspiration';
  }[];
  libraries: { name: string; url: string; license: string; scope: string }[];
}

export interface Overrides {
  missing_from_forbes?: { name: string; source: string; source_url: string; value: number; currency: 'USD' | 'EUR'; as_of: string }[];
}

export interface AllData {
  exchange_rates: KeyedFile;
  inflation: KeyedFile;
  reference: KeyedFile;
  distribution: KeyedFile;
  rice: KeyedFile;
  wealth_world: WealthFile;
  wealth_germany: WealthFile;
  prices: PricesFile;
  taxes: TaxesFile;
  credits: CreditsFile;
  overrides: Overrides;
}
