/**
 * Language registry. To add a language:
 *   1. create src/i18n/locales/<code>.json (copy en.json and translate every key)
 *   2. add one entry below
 * That is all: routing, the language switcher, hreflang tags, the i18n CI check,
 * the static page shells and the OG images are all generated from this list.
 */
export interface Language {
  /** URL segment and JSON file name, e.g. "en" → /en/, locales/en.json */
  code: string;
  /** BCP 47 tag used for Intl formatting (numbers, currencies, dates, plurals). */
  locale: string;
  /** Native name shown in the language switcher. */
  name: string;
  /** Text direction. */
  dir?: 'ltr' | 'rtl';
}

export const LANGUAGES: Language[] = [
  { code: 'en', locale: 'en-US', name: 'English' },
  { code: 'de', locale: 'de-DE', name: 'Deutsch' },
];

/** Fallback for missing keys and for visitors whose browser language is not supported. */
export const DEFAULT_LANGUAGE = 'en';

export function isLanguage(code: string | undefined | null): code is string {
  return !!code && LANGUAGES.some((l) => l.code === code);
}

/** Picks the best supported language for a list of browser languages (e.g. navigator.languages). */
export function detectLanguage(preferred: readonly string[]): string {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
