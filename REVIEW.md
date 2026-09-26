# Review: reading the site as a critical economist

One pass over every quantitative claim, looking for factual errors, unfair comparisons and broken definitions. Each finding says what was wrong and what was changed. Items marked *kept* were judged acceptable with the labelling now in place.

## 1. Definitions and comparisons

| # | Finding | Action |
|---|---|---|
| 1 | The scroll compared a German **individual full-time median** (54,066 €) with a US **household median** (87,460 $). Not the same concept. | Both bars are now labelled with their concept ("median full-time earnings, Germany" vs. "median household income, USA"); the methodology names the mismatch explicitly. *Kept* because no comparable US individual full-time figure was available from a verified source at build time. |
| 2 | German median **net wealth** is per household (Bundesbank), US median net worth per **family** (SCF). Close but not identical (SCF "family" ≈ primary economic unit). | Labelled per source; definition texts say household vs. family. |
| 3 | "Lifetime earnings" for Germany was initially a rounded literature number without a clear source. | Replaced by a transparent calculation (median × 45 years) marked derived, with the IAB range in the definition. It is an upper-bound simplification (no unemployment, no wage growth); said so. |
| 4 | The Germany page's "the top ten hold X % of what the poorer half owns" needs total household wealth, which no survey states precisely. | Total is derived (mean × households) and marked as estimate; caveat added that the ratio is an order of magnitude and that surveys under-cover the top, which makes the comparison conservative for the top. |
| 5 | Tax chapter: an early draft compared the OECD **tax wedge** of an average earner (47.9 %, includes employer contributions) with a billionaire's effective rate. Apples and oranges. | Removed. The calculator now computes the median earner's burden itself, with and without employee social contributions, and applies income-based effective rates to income and wealth-based rates to wealth. |
| 6 | Effective-rate studies were listed in one column without saying what they divide by. | Every row now carries a denominator badge ((a)/(b)/(c)) and a corporate-tax flag; the page states that rows are only comparable when both match. |
| 7 | Applying ProPublica's 3.4 % (tax / wealth growth) to a wage earner's income is not exactly the same denominator. | *Kept with labelling*: for a wage earner, gross wages are essentially the whole economic income, so the comparison is fair; the badge shows definition (b) and the assumptions text says it. |
| 8 | "Top 10 % pay 57 % of income tax" is true but only about income tax; it was at risk of being read as "of all taxes". | Text now says "wage and income tax" and adds the point that income tax does not reach unrealised wealth. |
| 9 | Inheritance-tax exemption figure: the 17.1 bn € is **exempted asset value**, not forgone revenue. | Definition says so explicitly to prevent the common mis-citation. |

## 2. Numbers checked

| Value | Check | Result |
|---|---|---|
| § 32a EStG 2026 tariff parameters | read from gesetze-im-internet.de | match; unit test verifies continuity at zone borders and 42 %/45 % marginal rates |
| Soli exemption 20,350 € (2026) | § 3 SolzG | match |
| Social contribution rates and ceilings 2026 | Bundesregierung page | match (KV 14.6 % + 2.9 % average supplementary, PV 3.6 %, RV 18.6 %, ALV 2.6 %; ceilings 101,400 / 69,750 €) |
| US brackets 2026, standard deduction, LTCG thresholds, estate exemption 15 M $ | Tax Foundation summary of Rev. Proc. 2025-32 | match; unit test verifies 37 % marginal above 640,600 $ |
| Bundesbank PHF 2023: median 103,200 €, mean 324,800 €, top 10 % = 54 %, bottom 50 % = 2.4 %, Gini 0.724 | Bundesbank press release and Monatsbericht | match |
| Destatis median gross annual full-time 2025 = 54,066 €; April 2025 monthly median 4,123 € | Destatis PR 113/2026, table | match |
| Census 2025 median household income 87,460 $ | P60-289 | match |
| Federal budget 2026 = 524.54 bn € | Bundestag | match |
| Forbes RT values (Musk 929 bn $ …) | fetched live 2026-09-26; annual list 2026 attached as range | consistent; Musk 839 bn $ on the March list vs. 929 bn $ real-time shows why ranges are shown |
| Manager Magazin 2025 (Schwarz 46.5 bn €) vs Forbes (56.7 bn $ ≈ 49.7 bn €) | Wikipedia snapshot of the list | plausible 7 % gap; shown as range |
| Rice: 21.65 mg per grain; Yang's 58 lb for 1.22 M grains ⇒ 21.6 mg | recomputed | consistent |
| Trade tax 3.5 % × 409 % = 14.3 % | Destatis PR 309/2025 | match |
| Corporate tax cut to 10 % by 2032 | Bundestag/Bundesrat July 2025 | match |
| ECB rate 1.1403 USD/EUR (2026-09-25) | live fetch | match |
| US CPI-U 2025 annual average | computed from 11 published months (October 2025 unpublished) | documented in the definition |

## 3. Claims removed or softened

- Removed an unsourced absolute dividend payout for the Quandt/Klatten siblings; replaced by the sourced dividend per share and the qualitative "main beneficiaries".
- Removed price items whose only source was a JS-rendered shop page (cars) or a blocked host.
- Softened "billionaires pay lower rates than the working class" to the specific Saez/Zucman claim with its definition and the note that it is contested; under definition (a) the opposite holds, and the objections chapter says so.
- The "they will leave" answer no longer says "few left": it gives the Norwegian count (82 in two years) and the revenue outcome, and concedes that behavioural responses reduce revenue estimates.
- The "not zero-sum" answer concedes the point fully and reframes the comparison as one of scale, not of taking.

## 4. Remaining weaknesses (disclosed on the Methodology page)

- Wealth estimates for private companies have error bars of tens of per cent; rankings inside the top ten are not robust.
- The German top ten depends on Forbes' citizenship field; Kühne, Merck and Reimann are shown separately rather than merged (merging two lists with different methods would be worse).
- The tax calculator ignores US state taxes, German church tax, children, and deductions beyond the lump sums; the income-tax base simplification (all social contributions deductible) slightly understates German tax at higher incomes.
- The SCF 2022 value is over its age limit until the 2025 wave appears; the UI flags it.
- Effective-rate research is contested on both sides; the site cites the studies and the main critiques but cannot settle the debate.
