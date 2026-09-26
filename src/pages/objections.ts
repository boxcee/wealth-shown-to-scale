import { t } from '../i18n';
import { getCurrency, getData, inDisplay } from '../data';
import { escapeHtml, money, number, percent } from '../format';
import { num } from '../ui/source';
import { currencyNote } from '../ui/layout';

const ORDER = ['paper', 'valuation', 'earned', 'zerosum', 'leave', 'twopercent', 'mittelstand'];

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const dist = d.distribution.values;
  const top = d.wealth_world.people[0];
  const schwarz = d.wealth_germany.people.find((p) => p.id === 'dieter-schwarz');
  const schwarzMM = schwarz?.wealth.alt_sources?.find((a) => a.source.includes('Manager'));
  const params: Record<string, string> = {
    topWealth: num(top.wealth, { label: top.name }),
    bmwDividend: num(dist.bmw_dividend_per_share_fy2025, { label: 'BMW', compact: false, digits: 2 }),
    schwarzForbes: schwarz ? num(schwarz.wealth, { label: schwarz.name }) : '',
    schwarzMM: schwarzMM ? escapeHtml(money(inDisplay({ ...schwarz!.wealth, value: schwarzMM.value, currency: schwarzMM.currency }, cur), cur)) : '',
    bottom50: num(dist.de_bottom50_net_wealth_share, { label: t('germany.bottom50') }),
    norwayLeavers: num(dist.norway_wealth_tax_leavers_2022_2023, { label: 'Norway' }),
    taxShare: num(dist.de_top10_income_tax_share, { digits: 0, label: t('germany.taxShare').slice(0, 30) }),
    top10share: num(dist.de_top10_net_wealth_share, { digits: 0, label: t('germany.top10share') }),
    exempt: num(dist.de_inheritance_tax_exempt_business_2024, { label: '§ 13a ErbStG' }),
  };
  const fill = (s: string) => escapeHtml(s).replace(/\{(\w+)\}/g, (m, k: string) => params[k] ?? m);

  root.innerHTML = `
    <h1>${escapeHtml(t('objections.title'))}</h1>
    <p class="lead">${escapeHtml(t('objections.lead'))}</p>
    ${currencyNote()}
    ${ORDER.map(
      (id) => `<article class="card objection-card" id="${id}">
        <h2>${escapeHtml(t(`objections.items.${id}.title`))}</h2>
        <p class="label">${escapeHtml(t('common.objection'))}</p>
        <p>${fill(t(`objections.items.${id}.steelman`))}</p>
        <p class="label">${escapeHtml(t('common.answer'))}</p>
        <p>${fill(t(`objections.items.${id}.answer`))}</p>
        <p class="label">${escapeHtml(t('common.trueCore'))}</p>
        <p class="core">${fill(t(`objections.items.${id}.core`))}</p>
      </article>`,
    ).join('')}
  `;
  if (location.hash) {
    const el = root.querySelector<HTMLElement>(location.hash);
    el?.scrollIntoView();
    el?.focus?.();
  }
  void number;
  void percent;
  return () => {};
}
