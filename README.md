# Wealth, shown to scale

A bilingual (English / German) static website that makes extreme wealth tangible:

- **Blocks and side-scroll** (the core, after Korostoff's original): one pixel of area = 1,000 € or $. Small blocks first (median earnings, median household wealth, a million, a working life, a billion), stacked vertically; then the largest German fortune and the largest fortune on Earth as a bar that moves sideways while you keep scrolling down, with a running counter, a progress bar, comparison boxes (lottery jackpots, budgets, school backlog, the poorer half of all households) and steel-manned objection cards along the way. The bar is drawn on a viewport-sized canvas, so its million-pixel width never touches browser limits. Rice and spend follow on the same page.
- **Rice**: one grain of rice = 100,000 (Humphrey Yang's scale), converted into grains, bowls, sacks and truckloads with a sourced grain weight.
- **Spend**: buy iPhones, teachers, child-care places, social housing, wind turbines and more from a real fortune. Every price has a source and a year; older prices can be rebased with the consumer price index.
- **Germany in proportion**, **Taxes (nominal vs. effective, three explicit definitions, interactive calculator)**, **Objections** (strongest form, data-based answer, honest "where it has a point"), **Methodology**, **Credits**.

Every number in the UI carries a source, a retrieval date, a reference period and a definition, visible via the ⓘ button. Estimates are marked ≈. Values older than their update interval are flagged. No tracking, no cookies, no third-party requests at runtime.

Live site: `https://boxcee.github.io/wealth-shown-to-scale/` (after the first deploy; see below).

## Credits

This project rebuilds and combines three originals. Nothing was copied; all code, texts and data are new.

| Original | Author | Link | Relationship |
|---|---|---|---|
| Wealth, shown to scale | Matt Korostoff | https://mkorostoff.github.io/1-pixel-wealth/ (offline when checked on 2026-09-26; mirror: https://hacktivis.me/git/mirror/1-pixel-wealth/, repo: https://github.com/MKorostoff/1-pixel-wealth) | re-implemented from scratch: 1 px = 1,000 $, horizontal scroll |
| Jeff Bezos' wealth in rice (TikTok, Feb 2020) | Humphrey Yang (@humphreytalks) | https://www.tiktok.com/@humphreytalks/video/6798276393634467077 (coverage: https://www.buzzfeednews.com/article/tanyachen/tiktok-jeff-bezos-wealth-rice-grains-video) | inspiration: one grain = 100,000 $ |
| Spend Bill Gates' Money | Neal Agarwal (neal.fun) | https://neal.fun/spend/ | inspiration: the spend-simulator format |

Licenses: the Korostoff repository mirror has no license file, neal.fun publishes no source; nothing was reused beyond the idea. Details, link-check dates and further formats we looked for are in `data/credits.json` and on the Credits page. Data sources and libraries are listed there too.

## Setup

```bash
npm install
npm run dev          # http://localhost:5173/wealth-shown-to-scale/
npm run build        # i18n check + schema validation + vite build + static page shells → dist/
npm run preview      # serve dist/ at http://localhost:4173/wealth-shown-to-scale/
npm test             # typecheck, i18n check, schema validation, unit tests (vitest)
npm run test:e2e     # Playwright smoke tests: every chapter in both languages, desktop + mobile
npm run update-data  # run the data pipeline against live sources
npm run og           # regenerate Open Graph images (public/og/, committed)
npm run lighthouse   # performance / accessibility audit of the built site
```

Node ≥ 20. The build target is ES2022. `BASE_PATH` (default `/wealth-shown-to-scale/`) and `SITE_URL` (default `https://boxcee.github.io`) can be overridden for a custom domain.

## Deploy

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main` (and after each successful data update). Enable Pages once in the repository settings: *Settings → Pages → Source: GitHub Actions*.

The build writes one static HTML shell per language and page (`/en/`, `/de/taxes/`, …) with `lang`, canonical, `hreflang` alternates and Open Graph tags, plus `404.html` so deep links resolve on Pages.

## Data and the update pipeline

All figures live in `data/*.json` and are validated against `schema/*.json` (JSON Schema 2020-12 via Ajv). Every value has the fields `value`, `unit`, `currency`, `source`, `source_url`, `retrieved_at`, `definition`, `is_estimate`, and usually `as_of`, `max_age_months`, `refresh_hint`, `alt_sources` (diverging figures from other sources) and `derived` (formula and inputs for calculated values).

| File | Content | Maintained by |
|---|---|---|
| `exchange_rates.json` | ECB USD/EUR reference rate | pipeline (`scripts/fetchers/ecb.ts`) |
| `inflation.json` | Eurostat HICP Germany, BLS CPI-U (annual averages, series) | pipeline (`scripts/fetchers/inflation.ts`) |
| `wealth_world.json`, `wealth_germany.json` | Top 10 world / Germany from Forbes Real-Time, with Forbes annual list and Manager Magazin as `alt_sources` | pipeline (`scripts/fetchers/forbes.ts`) + `data/overrides/wealth_alt_sources.json` |
| `reference.json` | median incomes, household wealth, lifetime earnings, federal budget, counts | manual, staleness-checked |
| `distribution.json` | wealth shares, Gini, income-tax shares, inheritance-tax statistics, Norway migration figure, BMW dividend | manual, staleness-checked |
| `prices.json` | spend-simulator prices with price year | manual, staleness-checked |
| `taxes.json` | statutory rates, effective-rate studies (tagged by denominator and corporate-tax treatment), calculator parameters | manual, staleness-checked |
| `rice.json` | grain weight and container definitions | manual |
| `credits.json` | originals with link status, libraries | manual, links re-checked by `scripts/check-links.ts` |

`npm run update-data` (locally or in `.github/workflows/update-data.yml`, monthly cron + `workflow_dispatch`):

1. fetches ECB, Eurostat, BLS and Forbes;
2. applies a **plausibility gate**: a fetched value deviating from the last known good value by more than the threshold (default 40 %, `--threshold 0.3` or `PLAUSIBILITY_THRESHOLD`) is *not* written;
3. validates every data file against its schema plus semantic checks;
4. lists **stale** manual entries (older than `max_age_months`, or the file default) with their `refresh_hint`;
5. appends accepted changes to `DATA-CHANGELOG.md`;
6. writes `.pipeline/report.json` and `.pipeline/issue.md`. The workflow commits the data, and if anything failed, was held back or is stale, opens/updates a GitHub issue *"Data review needed (YYYY-MM)"* with the values and source suggestions. Last known good always wins over a failed or implausible fetch.

Options: `--dry-run` (no writes), `--offline` (uses `tests/fixtures/`, used in CI), `--threshold 0.4`. Optional secret `BLS_API_KEY` raises the BLS rate limit.

Bloomberg's Billionaires Index cannot be fetched by a robot (blocked); Manager Magazin is paywalled, so its values are entered by hand from the Wikipedia snapshot in `data/overrides/wealth_alt_sources.json`. Both appear as alternative sources in the UI's range display.

## Adding a language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<code>.json` and translate every key (placeholders like `{money}` stay; plural forms are objects with CLDR categories `one`, `other`, …).
2. Add one line to `src/i18n/languages.ts`:
   ```ts
   { code: 'fr', locale: 'fr-FR', name: 'Français' },
   ```
3. `npm run check:i18n` reports missing/extra keys and placeholder mismatches (also runs in CI and before every build). Missing keys fall back to English at runtime.

That is all: routing (`/fr/…`), the switcher, `hreflang` tags, static shells, sitemap and OG images (`npm run og`) are generated from the registry. Numbers, currencies, dates and plurals are formatted with `Intl` for the language's locale.

## Project layout

```
data/            sourced JSON data (+ overrides/)
schema/          JSON schemas
scripts/         pipeline (update-data, fetchers/, lib/), validate-data, check-i18n, check-links, build-pages, build-og, lighthouse
src/             app: i18n/, data/, scroll/ (virtual scroll engine), pages/, ui/, tax/
tests/unit       vitest (engine maths, tax formulas, pipeline logic, i18n check)
tests/e2e        Playwright smoke tests
tests/fixtures   recorded API responses for offline pipeline runs
public/og        generated Open Graph images
.github/workflows  ci.yml, deploy.yml, update-data.yml
```

Documents: `METHODOLOGY.md` (definitions, sources, weaknesses), `DECISIONS.md` (design and data decisions), `REVIEW.md` (critical-economist review pass), `DATA-CHANGELOG.md` (every value the pipeline changed).

## License

MIT (see `LICENSE`). Third-party figures remain subject to their publishers' terms; each is cited.
