import { t, currentLanguage } from '../i18n';
import { getCurrency, getData, inDisplay, convert } from '../data';
import { escapeHtml, money, number, percent, ratio } from '../format';
import { num } from '../ui/source';
import { currencyNote, staleBanner } from '../ui/layout';
import { pathFor } from '../router';

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const lang = currentLanguage().code;
  const ref = d.reference.values;
  const dist = d.distribution.values;
  const median = inDisplay(ref.de_median_net_wealth_household, cur);
  const mean = inDisplay(ref.de_mean_net_wealth_household, cur);
  const income = inDisplay(ref.de_median_gross_annual_fulltime, cur);
  const people = d.wealth_germany.people;
  const total = people.reduce((s, p) => s + inDisplay(p.wealth, cur), 0);
  const households = ref.de_households_count.value;
  const totalWealth = inDisplay(ref.de_total_household_net_wealth, cur);
  const bottom50 = (totalWealth * dist.de_bottom50_net_wealth_share.value) / 100;

  const rows = people
    .map((p) => {
      const w = inDisplay(p.wealth, cur);
      const perCap = p.is_family ? (p.persons_named ? money(w / p.persons_named, cur) : `<span class="muted small">${escapeHtml(t('common.noData'))}</span>`) : '—';
      return `<tr>
        <td class="r">${p.rank}</td>
        <td>${escapeHtml(p.name)}${p.is_family ? ` <span class="badge" title="${escapeHtml(t('common.familyNote'))}">${escapeHtml(t('common.family'))}</span>` : ''}</td>
        <td>${escapeHtml(p.source_of_wealth)}</td>
        <td class="r">${num(p.wealth, { label: p.name })}</td>
        <td class="r">${escapeHtml(ratio(w / median))}</td>
        <td class="r">${escapeHtml(ratio(w / mean))}</td>
        <td class="r">${escapeHtml(number(w / income))}</td>
        <td class="r">${perCap}</td>
      </tr>`;
    })
    .join('');

  const missing = (d.overrides.missing_from_forbes ?? [])
    .map((m) => `<li>${escapeHtml(t('germany.missingItem', { name: m.name, money: money(convert(m.value, m.currency, cur), cur), source: '' })).replace(' ()', '')} <a href="${escapeHtml(m.source_url)}" rel="noopener" target="_blank">${escapeHtml(m.source)}</a> (${escapeHtml(m.as_of)})</li>`)
    .join('');

  root.innerHTML = `
    <h1>${escapeHtml(t('germany.title'))}</h1>
    <p class="lead">${escapeHtml(t('germany.lead'))}</p>
    ${currencyNote()}
    ${staleBanner([ref.de_median_net_wealth_household, ref.de_mean_net_wealth_household, ref.de_median_gross_annual_fulltime, dist.de_bottom50_net_wealth_share, dist.de_top10_net_wealth_share, ...people.map((p) => p.wealth)])}
    <h2>${escapeHtml(t('germany.benchmarks'))}</h2>
    <div class="grid">
      <div class="stat"><b>${num(ref.de_median_net_wealth_household, { label: t('germany.medianWealth') })}</b><span>${escapeHtml(t('germany.medianWealth'))}</span></div>
      <div class="stat"><b>${num(ref.de_mean_net_wealth_household, { label: t('germany.meanWealth') })}</b><span>${escapeHtml(t('germany.meanWealth'))}</span></div>
      <div class="stat"><b>${num(ref.de_median_gross_annual_fulltime, { label: t('germany.medianIncome') })}</b><span>${escapeHtml(t('germany.medianIncome'))}</span></div>
      <div class="stat"><b>${num(dist.de_bottom50_net_wealth_share, { label: t('germany.bottom50') })}</b><span>${escapeHtml(t('germany.bottom50'))}</span></div>
      <div class="stat"><b>${num(dist.de_top10_net_wealth_share, { label: t('germany.top10share'), digits: 0 })}</b><span>${escapeHtml(t('germany.top10share'))}</span></div>
      <div class="stat"><b>${num(dist.de_gini_net_wealth, { label: t('germany.gini') })}</b><span>${escapeHtml(t('germany.gini'))}</span></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th class="r">${escapeHtml(t('germany.table.rank'))}</th><th>${escapeHtml(t('germany.table.name'))}</th><th>${escapeHtml(t('germany.table.source'))}</th><th class="r">${escapeHtml(t('germany.table.wealth'))}</th><th class="r">${escapeHtml(t('germany.table.vsMedian'))}</th><th class="r">${escapeHtml(t('germany.table.vsMean'))}</th><th class="r">${escapeHtml(t('germany.table.incomeYears'))}</th><th class="r">${escapeHtml(t('germany.table.perCapita'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>${escapeHtml(t('germany.sum'))}</h2>
    <p>${escapeHtml(t('germany.sumText', { money: money(total, cur), households: number(Math.round(total / median)), years: number(Math.round(total / income)) }))}</p>
    <p>${t('germany.bottomText', { n: number(households / 2), share: num(dist.de_bottom50_net_wealth_share, { label: t('germany.bottom50') }), money: num(ref.de_total_household_net_wealth, { text: money(bottom50, cur), label: t('germany.bottom50') }), ratio: escapeHtml(percent((total / bottom50) * 100, 0)) })}</p>
    <p class="small muted">${escapeHtml(t('germany.bottomCaveat'))}</p>
    <h2>${escapeHtml(t('germany.familyHeading'))}</h2>
    <p>${escapeHtml(t('germany.familyText'))}</p>
    <ul>${missing}</ul>
    <p class="small muted">${escapeHtml(t('common.perCapitaUnknown'))}</p>
    <h2>${escapeHtml(t('germany.rangeHeading'))}</h2>
    <p>${escapeHtml(t('germany.rangeText'))}</p>
    <p>${t('germany.taxShare', { share: num(dist.de_top10_income_tax_share, { digits: 0, label: t('germany.taxShare').slice(0, 40) }) })}</p>
    <p><a href="${pathFor(lang, 'taxes')}">${escapeHtml(t('nav.taxes'))} →</a> · <a href="${pathFor(lang, 'objections')}">${escapeHtml(t('nav.objections'))} →</a></p>
  `;
  return () => {};
}
