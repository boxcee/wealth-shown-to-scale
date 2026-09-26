import { t, tRaw } from '../i18n';
import { getCurrency, getData, inDisplay } from '../data';
import { escapeHtml, money, number, percent } from '../format';
import { num } from '../ui/source';
import { currencyNote, staleBanner } from '../ui/layout';
import { deTotal, usTotal, type DeParams, type UsParams } from '../tax/calc';
import type { SourcedValue } from '../data/types';

function pick<T>(obj: Record<string, SourcedValue>): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.value])) as T;
}

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const tx = d.taxes;
  const de = tx.nominal.DE;
  const us = tx.nominal.US;
  const ref = d.reference.values;
  const dist = d.distribution.values;
  const deP = pick<DeParams>(tx.parameters.DE);
  const usP = pick<UsParams>(tx.parameters.US);

  const nominalRow = (label: string, deV: SourcedValue, deNote: string, usV: SourcedValue, usNote: string) =>
    `<tr><th>${escapeHtml(label)}</th><td>${num(deV, { digits: 1, label })}<br><span class="small muted">${escapeHtml(deNote)}</span></td><td>${num(usV, { digits: 1, label })}<br><span class="small muted">${escapeHtml(usNote)}</span></td></tr>`;

  const effRows = tx.effective
    .map((e) => {
      const cmp = e.comparison_rate !== undefined ? t(`taxes.effective.comparisons.${e.id}`, { rate: percent(e.comparison_rate, 1) }) : '';
      const rateText = e.rate_low !== undefined && e.rate_high !== undefined ? `${percent(e.rate_low, 1)} – ${percent(e.rate_high, 1)}` : undefined;
      return `<tr>
        <td>${escapeHtml(t(`taxes.effective.groups.${e.id}`))}<br><span class="small muted">${escapeHtml(e.group)}</span></td>
        <td class="r">${num(e.rate, { digits: 1, text: rateText, label: t(`taxes.effective.groups.${e.id}`) })}</td>
        <td><span class="def-badge">${escapeHtml(t(`taxes.effective.denom.${e.denominator}`))}</span></td>
        <td>${escapeHtml(e.includes_corporate_tax ? t('taxes.effective.included') : t('taxes.effective.excluded'))}</td>
        <td class="small">${escapeHtml(e.numerator)}</td>
        <td class="small">${escapeHtml(e.period ?? '')}</td>
        <td class="small">${escapeHtml(cmp)}</td>
      </tr>`;
    })
    .join('');

  const specifics = (tRaw<{ h: string; p: string }[]>('taxes.germanSpecifics.items') ?? [])
    .map((it) => `<div class="card"><h3>${escapeHtml(it.h)}</h3><p>${it.p
      .replace('{exempt}', num(dist.de_inheritance_tax_exempt_business_2024, { label: it.h }))
      .replace('{assessed}', num(dist.de_inheritance_tax_assessed_2024, { label: it.h }))}</p></div>`)
    .join('');

  root.innerHTML = `
    <h1>${escapeHtml(t('taxes.title'))}</h1>
    <p class="lead">${escapeHtml(t('taxes.lead'))}</p>
    ${currencyNote()}
    ${staleBanner([...Object.values(de), ...Object.values(us), ...tx.effective.map((e) => e.rate)])}
    <section class="card">
      <h2>${escapeHtml(t('taxes.definitions.title'))}</h2>
      <p>${escapeHtml(t('taxes.definitions.a'))}</p>
      <p>${escapeHtml(t('taxes.definitions.b'))}</p>
      <p>${escapeHtml(t('taxes.definitions.c'))}</p>
      <p class="muted">${escapeHtml(t('taxes.definitions.corp'))}</p>
    </section>
    <h2>${escapeHtml(t('taxes.nominal.title'))}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>${escapeHtml(t('taxes.nominal.tax'))}</th><th>${escapeHtml(t('taxes.nominal.de'))}</th><th>${escapeHtml(t('taxes.nominal.us'))}</th></tr></thead>
      <tbody>
        ${nominalRow(t('taxes.nominal.income'), de.income_tax_top_rate, t('taxes.nominal.incomeNoteDe', { threshold: money(inDisplay(de.income_tax_top_threshold, 'EUR'), 'EUR', { compact: false }) }), us.income_tax_top_rate, t('taxes.nominal.incomeNoteUs', { threshold: money(640600, 'USD', { compact: false }) }))}
        ${nominalRow(t('taxes.nominal.capital'), de.capital_income_flat_rate, t('taxes.nominal.capitalNoteDe'), us.capital_gains_top_rate, t('taxes.nominal.capitalNoteUs'))}
        ${nominalRow(t('taxes.nominal.corporate'), de.corporate_income_tax, t('taxes.nominal.corporateNoteDe'), us.corporate_income_tax, t('taxes.nominal.corporateNoteUs'))}
        ${nominalRow(t('taxes.nominal.inheritance'), de.inheritance_tax_class1_range, t('taxes.nominal.inheritanceNoteDe'), us.estate_tax_top_rate, t('taxes.nominal.inheritanceNoteUs', { exemption: money(15_000_000, 'USD') }))}
        ${nominalRow(t('taxes.nominal.wealth'), de.wealth_tax, t('taxes.nominal.wealthNoteDe'), us.wealth_tax, t('taxes.nominal.wealthNoteUs'))}
      </tbody>
    </table></div>
    <p class="small muted">${t('taxes.nominal.tradeTaxLine', { rate: num(de.trade_tax_average, { digits: 1, label: t('taxes.nominal.corporate') }) })}</p>
    <h2>${escapeHtml(t('taxes.effective.title'))}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>${escapeHtml(t('taxes.effective.group'))}</th><th class="r">${escapeHtml(t('taxes.effective.rate'))}</th><th>${escapeHtml(t('taxes.effective.denominator'))}</th><th>${escapeHtml(t('taxes.effective.corporate'))}</th><th>${escapeHtml(t('taxes.effective.numerator'))}</th><th>${escapeHtml(t('taxes.effective.period'))}</th><th>${escapeHtml(t('taxes.effective.compare'))}</th></tr></thead>
      <tbody>${effRows}</tbody>
    </table></div>
    <p class="small muted">${escapeHtml(t('taxes.effective.note'))}</p>
    <section class="card" id="calc">
      <h2>${escapeHtml(t('taxes.calc.title'))}</h2>
      <p>${escapeHtml(t('taxes.calc.lead'))}</p>
      <div class="calc">
        <label>${escapeHtml(t('taxes.calc.country'))}
          <select id="c-country"><option value="DE">${escapeHtml(t('taxes.nominal.de'))}</option><option value="US">${escapeHtml(t('taxes.nominal.us'))}</option></select>
        </label>
        <label>${escapeHtml(t('taxes.calc.income'))}
          <input type="number" id="c-income" min="0" step="1000" value="${Math.round(ref.de_median_gross_annual_fulltime.value)}">
        </label>
        <button type="button" class="btn" id="c-median">${escapeHtml(t('taxes.calc.useMedian'))}</button>
        <label><input type="checkbox" id="c-social" checked> ${escapeHtml(t('taxes.calc.socialToggle'))}</label>
      </div>
      <div class="calc-out" id="c-out" aria-live="polite"></div>
      <p class="small muted">${escapeHtml(t('taxes.calc.assumptions'))}</p>
      <p class="small muted">${escapeHtml(t('taxes.calc.socialNote'))}</p>
    </section>
    <h2>${escapeHtml(t('taxes.germanSpecifics.title'))}</h2>
    ${specifics}
  `;

  const countrySel = root.querySelector<HTMLSelectElement>('#c-country')!;
  const incomeIn = root.querySelector<HTMLInputElement>('#c-income')!;
  const socialCb = root.querySelector<HTMLInputElement>('#c-social')!;
  const out = root.querySelector<HTMLElement>('#c-out')!;

  function calc(): void {
    const country = countrySel.value as 'DE' | 'US';
    const ccy = country === 'DE' ? 'EUR' : 'USD';
    const gross = Math.max(0, Number(incomeIn.value) || 0);
    const r = country === 'DE' ? deTotal(gross, deP) : usTotal(gross, usP);
    const withSocial = socialCb.checked;
    const actual = r.incomeTax + r.surcharge + (withSocial ? r.social : 0);
    const fmt = (v: number) => money(v, ccy, { compact: false });
    const incomeRates = tx.effective.filter((e) => e.denominator !== 'wealth');
    const wealthRates = tx.effective.filter((e) => e.denominator === 'wealth');
    const medianWealth = country === 'DE' ? inDisplay(ref.de_median_net_wealth_household, 'EUR') : inDisplay(ref.us_median_net_worth_family, 'USD');
    out.innerHTML = `
      <p><strong>${escapeHtml(t('taxes.calc.yourTax'))}:</strong> ${escapeHtml(fmt(r.incomeTax + r.surcharge))}${r.surcharge ? ` <span class="small muted">(${escapeHtml(t('taxes.calc.yourTaxSoli'))} ${escapeHtml(fmt(r.surcharge))})</span>` : ''}</p>
      <p><strong>${escapeHtml(t('taxes.calc.yourSocial'))}:</strong> ${escapeHtml(fmt(r.social))}${withSocial ? '' : ` <span class="small muted">(${escapeHtml(t('common.without'))})</span>`}</p>
      <p><strong>${escapeHtml(t('taxes.calc.yourTotal'))}:</strong> ${escapeHtml(fmt(actual))} — ${escapeHtml(t('taxes.calc.yourRate', { rate: percent(gross ? (actual / gross) * 100 : 0, 1) }))}</p>
      <ul>${incomeRates
        .map((e) => {
          const alt = gross * (e.rate.value / 100);
          return `<li>${escapeHtml(t('taxes.calc.atRate', { rate: percent(e.rate.value, 1), who: t(`taxes.effective.groups.${e.id}`), money: fmt(alt), actual: fmt(actual) }))} <span class="small muted">${escapeHtml(t('taxes.calc.atRateDiff', { diff: fmt(actual - alt) }))} <span class="def-badge">${escapeHtml(t(`taxes.effective.denom.${e.denominator}`))}</span> ${escapeHtml(e.includes_corporate_tax ? t('common.with') : t('common.without'))} ${escapeHtml(t('taxes.effective.corporate').toLowerCase())}</span></li>`;
        })
        .join('')}</ul>
      <h3>${escapeHtml(t('taxes.calc.wealthTitle'))}</h3>
      <p>${escapeHtml(t('taxes.calc.wealthLead', { wealth: fmt(medianWealth) }))}</p>
      <ul>${wealthRates
        .map((e) => `<li>${escapeHtml(t('taxes.calc.wealthLine', { rate: percent(e.rate.value, 1), wealth: fmt(medianWealth), money: fmt(medianWealth * (e.rate.value / 100)), who: t(`taxes.effective.groups.${e.id}`), actual: fmt(actual) }))}</li>`)
        .join('')}</ul>`;
  }
  countrySel.addEventListener('change', () => { incomeIn.value = String(Math.round(countrySel.value === 'DE' ? ref.de_median_gross_annual_fulltime.value : ref.us_median_household_income.value)); calc(); });
  incomeIn.addEventListener('input', calc);
  socialCb.addEventListener('change', calc);
  root.querySelector<HTMLButtonElement>('#c-median')!.addEventListener('click', () => { incomeIn.value = String(Math.round(countrySel.value === 'DE' ? ref.de_median_gross_annual_fulltime.value : ref.us_median_household_income.value)); calc(); });
  calc();
  void cur;
  void number;
  return () => {};
}
