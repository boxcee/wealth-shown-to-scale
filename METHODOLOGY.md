# Methodology

The same content as the site's Methodology page, kept in the repository so it is versioned with the data. Every figure in `data/*.json` carries `source`, `source_url`, `retrieved_at`, `as_of`, `definition`, `is_estimate` (and `estimate_by`), and optionally `alt_sources`, `derived` (formula and inputs), `max_age_months` and `refresh_hint`.

## Principle

Credibility before impact. No number without a source; no own estimates without an external anchor; estimates marked ≈; ranges shown where sources disagree; "no reliable data" where nothing solid exists.

## Scale and conversion

- Scale: one pixel of area = 1,000 units of the display currency (a block of n pixels is n × 1,000). Blocks are squares where they fit, otherwise rectangles of the same area; the sideways bar has a fixed height, so its width × height gives the amount.
- USD ⇄ EUR at the ECB daily reference rate (`exchange_rates.json`, refreshed monthly, `as_of` = ECB date). The tooltip always shows the original currency and value.
- "Money scrolled" = sum of bars left of the viewport edge (pro rata inside a bar); gaps between bars carry no money. Only the largest German fortune and the largest fortune on Earth are drawn.

## Wealth data

- Primary: Forbes Real-Time Billionaires (`finalWorth` in million USD), top 10 overall and top 10 with citizenship "Germany". Estimate by Forbes: listed stakes at market prices, private companies by comparables, minus known debt. Family entries pool relatives.
- Alternative sources per person: Forbes annual list (snapshot of early in the year) and, for Germans, Manager Magazin's October 2025 list (via the Wikipedia table; paywalled magazine). Rule: the newest reputable estimate is the headline; others form the displayed range. Joint family figures are attached to each named sibling with a note.
- Missing from Forbes' German top ten but present in Manager Magazin: Klaus-Michael Kühne, Merck family, Reimann family (listed separately on the Germany page).
- Per-person values for families only where a source names the persons.

## Reference values

| Quantity | Source | Period |
|---|---|---|
| Median gross annual earnings, full-time, Germany | Destatis PR 113/2026 | 2025 |
| Median gross monthly earnings, full-time, Germany | Destatis table | April 2025 |
| Median household income, USA | Census P60-289 | 2025 |
| Median / mean household net wealth, Germany | Bundesbank PHF 2023 (Monatsbericht April 2025) | 2023 |
| Median family net worth, USA | Federal Reserve SCF 2022 | 2022 (flagged stale until the 2025 wave) |
| Households in Germany | Destatis Mikrozensus | 2024 |
| Lifetime earnings, Germany | derived: median × 45 years; IAB-Kurzbericht 18/2022 as cross-check | 2025 |
| Lifetime earnings, USA (high-school diploma) | Georgetown CEW, The College Payoff 2021 | 2021 |
| Federal budget | Bundestag, Haushaltsgesetz 2026 | 2026 |
| Wealth shares, Gini | Bundesbank PHF 2023 | 2023 |
| Income-tax share of top 10 % | BMF Datensammlung zur Steuerpolitik 2024 | 2024 |
| Inheritance and gift tax, § 13a exemptions | Destatis PR 320/2025 | 2024 |
| Billionaire counts | Oxfam (Forbes data as of 30 Nov 2025); Forbes annual list 2026 | 2025/2026 |

## Rice

grains = amount ÷ value per grain (default 100,000); mass = grains × 21.65 mg (1000-grain weight of milled rice, cultivar M-210, US patent 10,624,292; Yang's measurement implies 21.6 mg); bowls/sacks/trucks = mass ÷ 200 g / 25 kg / 25 t (declared unit definitions).

## Prices (spend simulator)

Each item: price, currency, price year, source. Inflation switch rebases with Eurostat HICP Germany (EUR) or BLS CPI-U (USD) annual averages from the price year to the latest complete year; off by default; original shown in the tooltip. Derived prices state their formula (ICE 4, social flat, wind turbine, Kita place).

## Taxes

- Statutory rates from the law texts (EStG, SolzG, KStG, GewStG, ErbStG, AStG; IRS / Rev. Proc. 2025-32).
- Effective rates from named studies, each tagged with denominator (a) taxable income, (b) economic income incl. unrealised gains or retained profits, (c) wealth, and whether corporate taxes are attributed to the owner. Rows with different tags are not comparable; the page says so.
- Calculator: German tariff § 32a EStG 2026 (formula parameters in `taxes.json`), Soli with threshold and 11.9 % phase-in cap, employee social contributions with 2026 ceilings, employee lump sum 1,230 €; simplification: all employee social contributions deducted before tax. US: standard deduction 16,100 $, 2026 federal brackets, Social Security 6.2 % up to 184,500 $, Medicare 1.45 %. Income-based effective rates are applied to gross income; wealth-based rates to the median household's net wealth.

## Update pipeline and staleness

Monthly GitHub Actions run (`update-data.yml`): fetch → plausibility gate (default 40 %) → schema validation → staleness check → commit → issue if a human is needed → Pages deploy. Details in `README.md` and `DECISIONS.md`. Manual entries carry `max_age_months`; the UI flags values beyond it with "older data" and a page banner. Changelog: `DATA-CHANGELOG.md`.

## Known weaknesses

- Private-company valuations: wide error bars; rankings inside the top ten are not robust.
- Surveys under-cover the top of the wealth distribution; the bottom-50 % share is if anything overstated.
- German full-time individual median vs. US household median are different concepts (both labelled).
- Calculator ignores US state taxes, church tax, children, and deductions beyond lump sums.
- Effective-rate studies are contested; critiques are summarised in the objections chapter.
- Forbes citizenship determines the German list; three large fortunes are therefore shown separately.
