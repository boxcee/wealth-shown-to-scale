import { t } from '../i18n';
import { getCurrency, getData, inDisplay, inflate } from '../data';
import { escapeHtml, money, number, percent } from '../format';
import { num } from '../ui/source';
import { currencyNote, staleBanner } from '../ui/layout';
import type { PriceItem } from '../data/types';

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const budgets = [
    ...d.wealth_world.people.map((p) => ({ id: `world-${p.id}`, label: `${p.name} (${t('nav.scroll') === 'Scroll' ? 'world' : 'Welt'} #${p.rank})`, value: inDisplay(p.wealth, cur), v: p.wealth })),
    ...d.wealth_germany.people.map((p) => ({ id: `de-${p.id}`, label: `${p.name} (DE #${p.rank})`, value: inDisplay(p.wealth, cur), v: p.wealth })),
  ];
  let budgetId = budgets.find((b) => b.id.startsWith('de-'))!.id;
  let inflation = false;
  const qty = new Map<string, number>();
  const latestYear = (c: 'EUR' | 'USD') => {
    const s = c === 'EUR' ? d.inflation.values.de_hicp_annual?.series : d.inflation.values.us_cpi_u_annual?.series;
    return s ? Number(Object.keys(s).sort().pop()) : new Date().getFullYear();
  };

  const priceOf = (it: PriceItem): number => {
    let amount = it.price.value;
    if (inflation && it.inflation_adjust && it.price.currency) {
      const r = inflate(amount, it.price.currency, it.price_year);
      if (r) amount = r.value;
    }
    return it.price.currency ? inDisplay({ ...it.price, value: amount }, cur) : amount;
  };

  root.innerHTML = `
    <h1>${escapeHtml(t('spend.title'))}</h1>
    <p class="lead">${escapeHtml(t('spend.lead'))}</p>
    ${currencyNote()}
    ${staleBanner(d.prices.items.map((i) => i.price))}
    <div class="card">
      <label>${escapeHtml(t('spend.budget'))}
        <select id="budget">${budgets.map((b) => `<option value="${b.id}" ${b.id === budgetId ? 'selected' : ''}>${escapeHtml(b.label)} – ${escapeHtml(money(b.value, cur))}</option>`).join('')}</select>
      </label>
      <label><input type="checkbox" id="infl"> ${escapeHtml(t('spend.inflation', { year: latestYear('EUR') }))}</label>
      <p class="small muted">${escapeHtml(t('spend.inflationNote'))}</p>
    </div>
    <div class="spend-top" aria-live="polite">
      <div><span class="small muted">${escapeHtml(t('spend.remaining'))}</span><br><span class="big" id="remaining"></span></div>
      <div><span class="small muted">${escapeHtml(t('spend.spent'))}</span><br><span class="big" id="spent"></span></div>
      <div class="spend-bar"><div id="bar"></div></div>
      <p id="summary" class="small" style="width:100%;margin:0"></p>
      <button type="button" class="btn" id="reset">${escapeHtml(t('spend.reset'))}</button>
    </div>
    <div id="items"></div>
  `;

  const itemsEl = root.querySelector<HTMLElement>('#items')!;
  const remainingEl = root.querySelector<HTMLElement>('#remaining')!;
  const spentEl = root.querySelector<HTMLElement>('#spent')!;
  const barEl = root.querySelector<HTMLElement>('#bar')!;
  const summaryEl = root.querySelector<HTMLElement>('#summary')!;

  function renderItems(): void {
    const cats: PriceItem['category'][] = ['consumer', 'society', 'climate', 'global'];
    itemsEl.innerHTML = cats
      .map((c) => {
        const list = d.prices.items.filter((i) => i.category === c);
        if (!list.length) return '';
        return `<h2>${escapeHtml(t(`spend.category.${c}`))}</h2>${list
          .map((it) => {
            const p = priceOf(it);
            const per = it.price.unit === 'currency_per_year' ? ` ${escapeHtml(t('spend.perYear'))}` : '';
            const rebased = inflation && it.inflation_adjust && it.price.currency && p !== inDisplay(it.price, cur);
            return `<div class="item" data-id="${it.id}">
              <div class="icon" aria-hidden="true">${it.icon ?? ''}</div>
              <div><strong>${escapeHtml(t(`spend.items.${it.id}`))}</strong><br><span class="price">${num(it.price, { text: money(p, cur, { compact: p >= 1e6 }), label: t(`spend.items.${it.id}`) })}${per} ${rebased ? `<span class="badge">${it.price_year} → ${latestYear(it.price.currency!)}</span>` : `<span class="badge">${it.price_year}</span>`}</span></div>
              <div class="qty">
                <button type="button" data-dec aria-label="${escapeHtml(t('spend.sell'))}">−</button>
                <input type="number" min="0" max="${it.max_quantity}" step="1" value="${qty.get(it.id) ?? 0}" aria-label="${escapeHtml(t('spend.quantity', { item: t(`spend.items.${it.id}`) }))}">
                <button type="button" data-inc aria-label="${escapeHtml(t('spend.buy'))}">+</button>
              </div>
            </div>`;
          })
          .join('')}`;
      })
      .join('');
    updateTotals();
  }

  function stepFor(it: PriceItem, budget: number): number {
    // Buy in chunks so small items are not hopeless against a fortune: 1, 10, 100, 1000…
    const p = priceOf(it);
    const ratio = budget / p;
    if (ratio > 1e7) return 100000;
    if (ratio > 1e6) return 10000;
    if (ratio > 1e5) return 1000;
    if (ratio > 1e4) return 100;
    if (ratio > 1e3) return 10;
    return 1;
  }

  function updateTotals(): void {
    const b = budgets.find((x) => x.id === budgetId)!;
    let spent = 0;
    let count = 0;
    for (const it of d.prices.items) {
      const q = qty.get(it.id) ?? 0;
      spent += q * priceOf(it);
      count += q;
    }
    const remaining = b.value - spent;
    remainingEl.textContent = money(remaining, cur, { compact: Math.abs(remaining) >= 1e6 });
    spentEl.textContent = money(spent, cur, { compact: spent >= 1e6 });
    const pct = b.value ? (spent / b.value) * 100 : 0;
    barEl.style.width = `${Math.min(100, pct)}%`;
    summaryEl.textContent = count
      ? t('spend.summary', { n: number(count), money: money(spent, cur), remaining: money(remaining, cur), pct: percent(100 - pct, pct < 1 ? 3 : 1) })
      : t('spend.summaryEmpty');
    itemsEl.querySelectorAll<HTMLElement>('.item').forEach((el) => {
      const it = d.prices.items.find((i) => i.id === el.dataset.id)!;
      const inc = el.querySelector<HTMLButtonElement>('[data-inc]')!;
      const input = el.querySelector<HTMLInputElement>('input')!;
      const step = stepFor(it, b.value);
      inc.textContent = step === 1 ? '+' : `+${number(step)}`;
      el.querySelector<HTMLButtonElement>('[data-dec]')!.textContent = step === 1 ? '−' : `−${number(step)}`;
      inc.disabled = remaining < priceOf(it);
      inc.title = inc.disabled ? t('spend.cantAfford') : '';
      input.value = String(qty.get(it.id) ?? 0);
    });
  }

  itemsEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    const row = (e.target as HTMLElement).closest<HTMLElement>('.item');
    if (!btn || !row) return;
    const it = d.prices.items.find((i) => i.id === row.dataset.id)!;
    const b = budgets.find((x) => x.id === budgetId)!;
    const step = stepFor(it, b.value);
    const current = qty.get(it.id) ?? 0;
    if (btn.hasAttribute('data-inc')) {
      const spent = d.prices.items.reduce((s, i) => s + (qty.get(i.id) ?? 0) * priceOf(i), 0);
      const affordable = Math.floor((b.value - spent) / priceOf(it));
      qty.set(it.id, Math.min(it.max_quantity, current + Math.min(step, Math.max(0, affordable))));
    } else if (btn.hasAttribute('data-dec')) {
      qty.set(it.id, Math.max(0, current - step));
    }
    updateTotals();
  });
  itemsEl.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const row = input.closest<HTMLElement>('.item');
    if (!row || input.tagName !== 'INPUT') return;
    const it = d.prices.items.find((i) => i.id === row.dataset.id)!;
    qty.set(it.id, Math.max(0, Math.min(it.max_quantity, Math.floor(Number(input.value) || 0))));
    updateTotals();
  });
  root.querySelector<HTMLSelectElement>('#budget')!.addEventListener('change', (e) => { budgetId = (e.target as HTMLSelectElement).value; updateTotals(); });
  root.querySelector<HTMLInputElement>('#infl')!.addEventListener('change', (e) => { inflation = (e.target as HTMLInputElement).checked; renderItems(); });
  root.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => { qty.clear(); updateTotals(); });
  renderItems();
  return () => {};
}
