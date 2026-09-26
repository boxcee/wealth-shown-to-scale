export interface SourcedValue {
  value: number;
  unit: 'currency' | 'currency_per_year' | 'currency_per_month' | 'percent' | 'index' | 'grams' | 'count' | 'ratio' | 'years';
  currency: string | null;
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
  currency: string | null;
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
