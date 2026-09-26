import { t } from '../i18n';
import { getCurrency, getData, inDisplay } from '../data';
import { escapeHtml, money, number } from '../format';
import { num } from '../ui/source';
import { currencyNote, staleBanner } from '../ui/layout';
import { pathFor } from '../router';
import { currentLanguage } from '../i18n';

const GRAIN_VALUES = [1000, 10000, 100000, 1000000];
const MAX_DOTS = 40000;

export function render(root: HTMLElement, opts: { embedded?: boolean } = {}): () => void {
  const H = opts.embedded ? 'h2' : 'h1';
  const d = getData();
  const cur = getCurrency();
  const lang = currentLanguage().code;
  const rice = d.rice.values;
  const ref = d.reference.values;
  const grainG = rice.grain_weight_g.value;
  const bowlG = rice.bowl_weight_g.value;
  const sackG = rice.sack_weight_g.value;
  const truckG = rice.truck_weight_g.value;
  const topDe = d.wealth_germany.people[0];
  const topWorld = d.wealth_world.people[0];

  const options: { id: string; label: string; value: number; html: string }[] = [
    { id: 'median_wealth_de', label: t('rice.options.median_wealth_de'), value: inDisplay(ref.de_median_net_wealth_household, cur), html: num(ref.de_median_net_wealth_household, { label: t('rice.options.median_wealth_de') }) },
    { id: 'median_income_de', label: t('rice.options.median_income_de'), value: inDisplay(ref.de_median_gross_annual_fulltime, cur), html: num(ref.de_median_gross_annual_fulltime, { label: t('rice.options.median_income_de') }) },
    { id: 'millionaire', label: t('rice.options.millionaire'), value: 1_000_000, html: escapeHtml(money(1_000_000, cur, { compact: false })) },
    { id: 'germany_top', label: t('rice.options.germany_top', { name: topDe.name }), value: inDisplay(topDe.wealth, cur), html: num(topDe.wealth, { label: topDe.name }) },
    { id: 'world_top', label: t('rice.options.world_top', { name: topWorld.name }), value: inDisplay(topWorld.wealth, cur), html: num(topWorld.wealth, { label: topWorld.name }) },
  ];
  let grainValue = 100000;
  let selected = options[3].id;

  root.innerHTML = `
    <${H}>${escapeHtml(t('rice.title'))}</${H}>
    <p class="lead">${escapeHtml(t('rice.lead', { grainValue: money(100000, 'USD', { compact: false }), currency: cur }))}</p>
    ${currencyNote()}
    ${staleBanner([ref.de_median_net_wealth_household, ref.de_median_gross_annual_fulltime, topDe.wealth, topWorld.wealth])}
    <p class="small">${t('rice.grainWeight', {
      weight: num(rice.grain_weight_g, { label: t('rice.grainValue') }),
      bowl: num(rice.bowl_weight_g, { text: `${number(bowlG)} g` }),
      sack: num(rice.sack_weight_g, { text: `${number(sackG / 1000)} kg` }),
      truck: num(rice.truck_weight_g, { text: `${number(truckG / 1e6)} t` }),
    })}</p>
    <div class="card grid">
      <label>${escapeHtml(t('rice.grainValue'))}
        <select id="grain">${GRAIN_VALUES.map((v) => `<option value="${v}" ${v === grainValue ? 'selected' : ''}>${escapeHtml(money(v, cur, { compact: false }))}</option>`).join('')}</select>
      </label>
      <label>${escapeHtml(t('rice.choose'))}
        <select id="fortune">${options.map((o) => `<option value="${o.id}" ${o.id === selected ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>
      </label>
    </div>
    <div id="out"></div>
    <p class="small muted">${escapeHtml(t('rice.explain'))}</p>
    ${opts.embedded ? '' : `<p><a href="${pathFor(lang, 'spend')}">${escapeHtml(t('nav.spend'))} →</a></p>`}
  `;

  const out = root.querySelector<HTMLElement>('#out')!;

  function update(): void {
    const o = options.find((x) => x.id === selected)!;
    const grains = o.value / grainValue;
    const massG = grains * grainG;
    const kg = massG / 1000;
    const bowls = massG / bowlG;
    const sacks = massG / sackG;
    const trucks = massG / truckG;
    let unitIcon = '🍚';
    let unitCount = bowls;
    let unitKey = 'rice.bowls';
    if (trucks >= 1) { unitIcon = '🚚'; unitCount = trucks; unitKey = 'rice.trucks'; }
    else if (sacks >= 1) { unitIcon = '🛍️'; unitCount = sacks; unitKey = 'rice.sacks'; }
    const iconsShown = Math.min(400, Math.ceil(unitCount));
    const multiplier = unitCount > 400 ? Math.ceil(unitCount / 400) : 1;

    out.innerHTML = `
      <h2>${escapeHtml(o.label)}: ${o.html}</h2>
      <div class="rice-stats">
        <div class="stat"><b>${escapeHtml(t('rice.grains', { count: Math.round(grains), n: number(Math.round(grains)) }))}</b><span>${escapeHtml(money(grainValue, cur, { compact: false }))} / 🌾</span></div>
        <div class="stat"><b>${escapeHtml(kg >= 1000 ? t('rice.tonnes', { t: number(kg / 1000, kg / 1000 >= 100 ? 0 : 1) }) : t('rice.weight', { kg: number(kg, kg >= 100 ? 0 : 2) }))}</b><span>${escapeHtml(number(grainG * 1000, 2))} mg × ${escapeHtml(number(Math.round(grains)))}</span></div>
        <div class="stat"><b>${escapeHtml(t('rice.bowls', { count: Math.round(bowls), n: number(bowls, bowls < 10 ? 1 : 0) }))}</b><span>${escapeHtml(number(bowlG))} g</span></div>
        <div class="stat"><b>${escapeHtml(t('rice.sacks', { count: Math.round(sacks), n: number(sacks, sacks < 10 ? 2 : 0) }))}</b><span>${escapeHtml(number(sackG / 1000))} kg</span></div>
        <div class="stat"><b>${escapeHtml(t('rice.trucks', { count: Math.round(trucks), n: number(trucks, trucks < 10 ? 2 : 0) }))}</b><span>${escapeHtml(number(truckG / 1e6))} t</span></div>
      </div>
      ${grains <= MAX_DOTS
        ? `<p class="small muted">${escapeHtml(t('rice.drawn'))}</p><canvas class="rice-canvas" id="rc" aria-label="${escapeHtml(t('rice.grains', { count: Math.round(grains), n: number(Math.round(grains)) }))}" role="img"></canvas>`
        : `<p class="small muted">${escapeHtml(t('rice.tooMany', { unit: t(unitKey, { count: 1, n: multiplier === 1 ? '1' : number(multiplier) }) }))}</p><div class="icon-field" role="img" aria-label="${escapeHtml(t(unitKey, { count: Math.round(unitCount), n: number(Math.round(unitCount)) }))}">${unitIcon.repeat(iconsShown)}</div>`}
    `;
    const canvas = out.querySelector<HTMLCanvasElement>('#rc');
    if (canvas) drawGrains(canvas, Math.round(grains));
  }

  function drawGrains(canvas: HTMLCanvasElement, n: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor;
    ctx.fillRect(0, 0, w, h);
    const cols = Math.ceil(Math.sqrt((n * w) / h));
    const cell = Math.max(2, Math.min(14, w / Math.max(1, cols)));
    const perRow = Math.floor(w / cell);
    ctx.fillStyle = '#e8d8a8';
    ctx.strokeStyle = '#b89b5a';
    for (let i = 0; i < n; i++) {
      const cx = (i % perRow) * cell + cell / 2;
      const cy = Math.floor(i / perRow) * cell + cell / 2;
      if (cy > h) break;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.42, cell * 0.22, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      if (cell > 4) ctx.stroke();
    }
  }

  root.querySelector<HTMLSelectElement>('#grain')!.addEventListener('change', (e) => { grainValue = Number((e.target as HTMLSelectElement).value); update(); });
  root.querySelector<HTMLSelectElement>('#fortune')!.addEventListener('change', (e) => { selected = (e.target as HTMLSelectElement).value; update(); });
  const onResize = () => update();
  window.addEventListener('resize', onResize);
  update();
  return () => window.removeEventListener('resize', onResize);
}
