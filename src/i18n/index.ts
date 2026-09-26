import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './languages';

type Messages = Record<string, unknown>;
type Params = Record<string, string | number>;

const loaders = import.meta.glob<{ default: Messages }>('./locales/*.json');

const cache = new Map<string, Messages>();
let current: Language = LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!;
let fallback: Messages = {};

async function load(code: string): Promise<Messages> {
  if (cache.has(code)) return cache.get(code)!;
  const loader = loaders[`./locales/${code}.json`];
  if (!loader) throw new Error(`No locale file for "${code}"`);
  const mod = await loader();
  cache.set(code, mod.default);
  return mod.default;
}

/** Loads the requested language (and the English fallback) and makes it current. */
export async function setLanguage(code: string): Promise<Language> {
  const lang = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!;
  const [msgs, fb] = await Promise.all([load(lang.code), load(DEFAULT_LANGUAGE)]);
  cache.set(lang.code, msgs);
  fallback = fb;
  current = lang;
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir ?? 'ltr';
  return lang;
}

export function currentLanguage(): Language {
  return current;
}

function lookup(msgs: Messages, key: string): unknown {
  let node: unknown = msgs;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * Translate a key. Plural forms are objects like {"one": "...", "other": "..."} and are
 * selected with Intl.PluralRules from params.count. Missing keys fall back to English,
 * then to the key itself (the CI check keeps this from happening in production).
 */
export function t(key: string, params?: Params): string {
  let value = lookup(cache.get(current.code) ?? {}, key);
  if (value === undefined) value = lookup(fallback, key);
  if (value === undefined) return key;
  if (typeof value === 'object' && value !== null) {
    const forms = value as Record<string, string>;
    const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
    let rules = pluralRules.get(current.locale);
    if (!rules) {
      rules = new Intl.PluralRules(current.locale);
      pluralRules.set(current.locale, rules);
    }
    const form = rules.select(count);
    value = forms[form] ?? forms.other ?? Object.values(forms)[0];
  }
  return interpolate(String(value), params);
}

/** Returns a raw (possibly nested) message object, e.g. a list of paragraphs. */
export function tRaw<T = unknown>(key: string): T | undefined {
  const v = lookup(cache.get(current.code) ?? {}, key) ?? lookup(fallback, key);
  return v as T | undefined;
}

/** Array helper: keys that hold arrays of strings (paragraph lists). */
export function tList(key: string, params?: Params): string[] {
  const v = tRaw<unknown>(key);
  if (!Array.isArray(v)) return [];
  return v.map((s) => interpolate(String(s), params));
}
