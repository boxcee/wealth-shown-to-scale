import { currentLanguage, t } from '../i18n';
import { getCurrency, getData, inDisplay } from '../data';
import { escapeHtml, money, number } from '../format';
import { num } from '../ui/source';
import { staleBanner } from '../ui/layout';
import { pathFor } from '../router';
import { ScrollView, type Marker } from '../scroll/view';
import type { Segment, LaidOut } from '../scroll/engine';
import type { Person, SourcedValue } from '../data/types';

const SCALES = [100, 1000, 10000];

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const lang = currentLanguage().code;
  const ref = d.reference.values;
  const dist = d.distribution.values;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- segments -------------------------------------------------------------
  const valueMap = new Map<string, SourcedValue>();
  const personMap = new Map<string, Person>();
  const segments: Segment[] = [];
  const addRef = (id: string, v: SourcedValue, kind: Segment['kind'] = 'reference') => {
    valueMap.set(id, v);
    segments.push({ id, value: inDisplay(v, cur), kind });
  };
  addRef('median_income_de', ref.de_median_gross_annual_fulltime);
  addRef('median_income_us', ref.us_median_household_income);
  addRef('median_wealth_de', ref.de_median_net_wealth_household);
  addRef('median_wealth_us', ref.us_median_net_worth_family);
  segments.push({ id: 'million', value: 1_000_000, kind: 'million' });
  addRef('lifetime_de', ref.de_lifetime_earnings_median_derived, 'lifetime');
  addRef('lifetime_us', ref.us_lifetime_earnings_high_school, 'lifetime');
  for (const p of d.wealth_world.people) {
    personMap.set(`world-${p.id}`, p);
    segments.push({ id: `world-${p.id}`, value: inDisplay(p.wealth, cur), kind: 'world' });
  }
  for (const p of d.wealth_germany.people) {
    personMap.set(`de-${p.id}`, p);
    segments.push({ id: `de-${p.id}`, value: inDisplay(p.wealth, cur), kind: 'germany' });
  }

  const medianIncome = inDisplay(ref.de_median_gross_annual_fulltime, cur);
  const medianWealth = inDisplay(ref.de_median_net_wealth_household, cur);
  const lifetime = inDisplay(ref.de_lifetime_earnings_median_derived, cur);
  const worldTotal = d.wealth_world.people.reduce((s, p) => s + inDisplay(p.wealth, cur), 0);
  const deTotal = d.wealth_germany.people.reduce((s, p) => s + inDisplay(p.wealth, cur), 0);
  const refTotal = segments.filter((s) => !s.id.startsWith('world-') && !s.id.startsWith('de-')).reduce((s, x) => s + x.value, 0);
  const bottom50 = (inDisplay(ref.de_total_household_net_wealth, cur) * dist.de_bottom50_net_wealth_share.value) / 100;

  // ---- markers (money thresholds) and contextual objection cards ------------
  const fm = (v: number) => money(v, cur);
  const objLink = (id: string) => `<a href="${pathFor(lang, 'objections')}#${id}">${escapeHtml(t('scroll.readFull'))}</a>`;
  const obj = (id: string, key: string, at: Marker['at'], params: Record<string, string | number> = {}): Marker => ({
    id: `obj-${id}`,
    at,
    kind: 'objection',
    html: `<h4>${escapeHtml(t('scroll.objectionCard'))}</h4><p><strong>${escapeHtml(t(`objections.items.${key}.title`))}</strong></p><p>${escapeHtml(t(`objections.items.${key}.core`, params))}</p><p>${objLink(key)}</p>`,
  });
  const firstWorld = `world-${d.wealth_world.people[0].id}`;
  const firstDe = `de-${d.wealth_germany.people[0].id}`;
  const schwarz = d.wealth_germany.people.find((p) => p.id === 'dieter-schwarz');
  const markers: Marker[] = [
    { id: 'm-median1000', money: refTotal + medianIncome * 1000, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.median1000', { money: fm(medianIncome * 1000) }))}</p>` },
    { id: 'm-lifetime100', money: refTotal + lifetime * 100, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.lifetime100', { money: fm(lifetime * 100) }))}</p>` },
    { id: 'm-households', money: refTotal + medianWealth * 100_000, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.medianHouseholds', { money: fm(medianWealth * 100_000), n: number(100_000) }))}</p>` },
    { id: 'm-hunger', money: refTotal + inDisplay(d.prices.items.find((i) => i.id === 'end_hunger_year')!.price, cur), kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.endHunger', { money: fm(inDisplay(d.prices.items.find((i) => i.id === 'end_hunger_year')!.price, cur)) }))}</p>` },
    { id: 'm-schools', money: refTotal + inDisplay(d.prices.items.find((i) => i.id === 'school_investment_backlog_de')!.price, cur), kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.schoolBacklog', { money: fm(inDisplay(d.prices.items.find((i) => i.id === 'school_investment_backlog_de')!.price, cur)) }))}</p>` },
    { id: 'm-bottom50', money: refTotal + bottom50, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.bottom50', { money: fm(bottom50), share: `${number(dist.de_bottom50_net_wealth_share.value, 1)} %`, total: fm(inDisplay(ref.de_total_household_net_wealth, cur)) }))}</p>` },
    { id: 'm-budget', money: refTotal + inDisplay(ref.de_federal_budget_2026, cur), kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.federalBudget', { money: fm(inDisplay(ref.de_federal_budget_2026, cur)) }))}</p>` },
    { id: 'm-worldtotal', money: refTotal + worldTotal, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.worldTotal', { money: fm(worldTotal) }))}</p>` },
    { id: 'm-detotal', money: refTotal + worldTotal + deTotal, kind: 'marker', html: `<p>${escapeHtml(t('scroll.markers.germanyTotal', { money: fm(deTotal) }))}</p>` },
    obj('paper', 'paper', { segmentId: firstWorld, offset: 260 }, { topWealth: fm(segments.find((s) => s.id === firstWorld)!.value), bmwDividend: '' }),
    obj('earned', 'earned', { segmentId: firstWorld, offset: 2600 }),
    obj('zerosum', 'zerosum', { segmentId: `world-${d.wealth_world.people[2].id}`, offset: 900 }, { bottom50: `${number(dist.de_bottom50_net_wealth_share.value, 1)} %` }),
    obj('twopercent', 'twopercent', { segmentId: `world-${d.wealth_world.people[6].id}`, offset: 900 }, { taxShare: `${number(dist.de_top10_income_tax_share.value)} %` }),
    obj('valuation', 'valuation', { segmentId: firstDe, offset: 260 }, {
      schwarzForbes: schwarz ? fm(inDisplay(schwarz.wealth, cur)) : '',
      schwarzMM: schwarz?.wealth.alt_sources?.find((a) => a.source.includes('Manager'))
        ? fm(inDisplay({ ...schwarz.wealth, value: schwarz.wealth.alt_sources!.find((a) => a.source.includes('Manager'))!.value, currency: 'EUR' }, cur))
        : '',
    }),
    obj('mittelstand', 'mittelstand', { segmentId: `de-${d.wealth_germany.people[3].id}`, offset: 900 }, { exempt: fm(inDisplay(dist.de_inheritance_tax_exempt_business_2024, cur)) }),
    obj('leave', 'leave', { segmentId: `de-${d.wealth_germany.people[6].id}`, offset: 900 }, { norwayLeavers: number(dist.norway_wealth_tax_leavers_2022_2023.value) }),
  ];

  // ---- static page parts ----------------------------------------------------
  const top = d.wealth_world.people[0];
  const scaleParam = new URLSearchParams(location.search).get('scale');
  let scale = SCALES.includes(Number(scaleParam)) ? Number(scaleParam) : 1000;
  const allValues = [...valueMap.values(), ...d.wealth_world.people.map((p) => p.wealth), ...d.wealth_germany.people.map((p) => p.wealth)];

  root.innerHTML = `
    <section class="scroll-intro">
      <h1>${escapeHtml(t('intro.title'))}</h1>
      <p class="lead">${t('intro.lead', {
        scale: escapeHtml(money(scale, cur)),
        medianIncome: num(ref.de_median_gross_annual_fulltime, { label: t('scroll.segments.median_income_de') }),
        medianPx: number(Math.round(medianIncome / scale)),
        topName: escapeHtml(top.name),
        topWealth: num(top.wealth, { label: top.name }),
      })}</p>
      <p class="small muted">${t('intro.credit', { creditsLink: `<a href="${pathFor(lang, 'credits')}">${escapeHtml(t('intro.creditsLinkText'))}</a>` })}</p>
      ${staleBanner(allValues)}
      <p class="small muted">${escapeHtml(t('intro.howTo'))}</p>
    </section>
    <div class="scroll-toolbar">
      <div class="counter" aria-live="off"><span id="counter">${escapeHtml(money(0, cur))}</span><small>${escapeHtml(t('scroll.counter'))}</small></div>
      <label>${escapeHtml(t('scroll.scale'))}
        <select id="scale">${SCALES.map((s) => `<option value="${s}" ${s === scale ? 'selected' : ''}>${escapeHtml(t('scroll.scaleOption', { money: money(s, cur, { compact: false }) }))}</option>`).join('')}</select>
      </label>
      <label>${escapeHtml(t('scroll.jump'))}
        <select id="jump"><option value=""></option>${segments.map((s) => `<option value="${s.id}">${escapeHtml(plainLabel(s.id))}</option>`).join('')}</select>
      </label>
      <button type="button" class="btn" id="play" aria-pressed="false">▶ ${escapeHtml(t('scroll.play'))}</button>
      <label>${escapeHtml(t('scroll.speed'))}
        <select id="speed"><option value="120">${escapeHtml(t('scroll.speedSlow'))}</option><option value="300" selected>${escapeHtml(t('scroll.speedNormal'))}</option><option value="900">${escapeHtml(t('scroll.speedFast'))}</option></select>
      </label>
      <button type="button" class="btn" id="share">${escapeHtml(t('scroll.share'))}</button>
    </div>
    <div class="scroll-stage" id="stage" role="region" aria-label="${escapeHtml(t('scroll.regionLabel'))}"></div>
    <div class="minimap" id="minimap" aria-hidden="true"></div>
    <p class="sr-only" id="live" aria-live="polite"></p>
    <div class="jump-list" id="jumplist" role="group" aria-label="${escapeHtml(t('scroll.jump'))}">
      ${segments.map((s) => `<button type="button" data-jump="${s.id}">${escapeHtml(plainLabel(s.id))}</button>`).join('')}
    </div>
    <section class="end-card card" id="end" hidden>
      <h2>${escapeHtml(t('scroll.end.title'))}</h2>
      <p id="end-text"></p>
      <p>${t('scroll.end.next', { riceLink: `<a href="${pathFor(lang, 'rice')}">${escapeHtml(t('scroll.end.riceLink'))}</a>`, spendLink: `<a href="${pathFor(lang, 'spend')}">${escapeHtml(t('scroll.end.spendLink'))}</a>` })}</p>
    </section>
  `;

  function plainLabel(id: string): string {
    const p = personMap.get(id);
    if (p) return t(id.startsWith('world-') ? 'scroll.segments.world' : 'scroll.segments.germany', { rank: p.rank, name: p.name });
    return t(`scroll.segments.${id}`);
  }

  function labelFor(it: LaidOut): string {
    const p = personMap.get(it.id);
    if (p) {
      const fam = p.is_family ? `<span class="badge">${escapeHtml(t('common.family'))}</span>` : '';
      return `<strong>${escapeHtml(plainLabel(it.id))}${fam}</strong>${num(p.wealth, { label: p.name })}<br><span class="muted small">${escapeHtml(t('scroll.segmentSub.person', { source: p.source_of_wealth, country: p.country }))}</span>`;
    }
    if (it.id === 'million') return `<strong>${escapeHtml(t('scroll.segments.million'))}</strong>${escapeHtml(money(1_000_000, cur, { compact: false }))}<br><span class="muted small">${escapeHtml(t('scroll.segmentSub.million'))}</span>`;
    const v = valueMap.get(it.id)!;
    const sub = it.kind === 'lifetime' ? `<br><span class="muted small">${escapeHtml(t('scroll.segmentSub.lifetime'))}</span>` : '';
    return `<strong>${escapeHtml(plainLabel(it.id))}</strong>${num(v, { label: plainLabel(it.id) })}${sub}`;
  }

  function sectionFor(it: LaidOut): string | null {
    if (it.id === 'median_income_de') return t('scroll.sections.reference');
    if (it.id === firstWorld) return t('scroll.sections.world');
    if (it.id === firstDe) return t('scroll.sections.germany');
    return null;
  }

  const css = getComputedStyle(document.documentElement);
  const colors: Record<string, string> = {
    reference: css.getPropertyValue('--bar-ref').trim(),
    lifetime: css.getPropertyValue('--bar-ref').trim(),
    million: css.getPropertyValue('--bar-million').trim(),
    world: css.getPropertyValue('--bar-world').trim(),
    germany: css.getPropertyValue('--bar-de').trim(),
  };

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const counter = root.querySelector<HTMLElement>('#counter')!;
  const live = root.querySelector<HTMLElement>('#live')!;
  const minimap = root.querySelector<HTMLElement>('#minimap')!;
  const endCard = root.querySelector<HTMLElement>('#end')!;
  const endText = root.querySelector<HTMLElement>('#end-text')!;
  const jumpButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-jump]')];
  let lastAnnounced = '';
  let announceTimer = 0;
  let hashTimer = 0;

  let view: ScrollView | undefined;
  view = new ScrollView({
    stage,
    segments,
    scale,
    markers,
    labelFor,
    sectionFor,
    colorFor: (it) => colors[it.kind] ?? colors.reference,
    formatMoney: (v) => money(v, cur),
    reducedMotion: reduced,
    onMove: ({ x, money: m, item, progress }) => {
      if (!view) return; // constructor renders once before the reference exists
      counter.textContent = money(m, cur, { compact: m >= 1e6 });
      const vw = stage.clientWidth;
      const mmWidth = minimap.clientWidth;
      const viewEl = minimap.querySelector<HTMLElement>('.mm-view');
      if (viewEl && view.layout.totalWidth > 0) {
        viewEl.style.left = `${(x / view.layout.totalWidth) * mmWidth}px`;
        viewEl.style.width = `${Math.max(3, (vw / view.layout.totalWidth) * mmWidth)}px`;
      }
      const near = view.layout.totalWidth - x <= vw * 1.05;
      if (near !== !endCard.hidden) {
        endCard.hidden = !near;
        if (near) endText.textContent = t('scroll.end.text', { money: money(view.layout.totalMoney, cur), px: number(Math.round(view.layout.totalWidth)), km: number(view.layout.totalWidth / 3780 / 1000, 0) });
      }
      const label = item ? plainLabel(item.id) : '';
      if (label !== lastAnnounced) {
        lastAnnounced = label;
        jumpButtons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.jump === item?.id)));
        clearTimeout(announceTimer);
        announceTimer = window.setTimeout(() => {
          live.textContent = `${t('scroll.nowAt', { label })} ${t('scroll.counterAria', { money: money(m, cur) })}`;
        }, 400);
      }
      clearTimeout(hashTimer);
      hashTimer = window.setTimeout(() => {
        const h = `#x=${Math.round(x)}`;
        if (location.hash !== h) history.replaceState(null, '', `${location.pathname}${location.search}${h}`);
      }, 250);
      void progress;
    },
  });

  view.render();

  // minimap
  const buildMinimap = () => {
    const total = view.layout.totalWidth || 1;
    minimap.innerHTML =
      view.layout.items
        .map((it) => `<div class="mm-seg" style="left:${(it.x0 / total) * 100}%;width:${Math.max(0.15, ((it.x1 - it.x0) / total) * 100)}%;background:${colors[it.kind]}"></div>`)
        .join('') + '<div class="mm-view"></div>';
  };
  buildMinimap();
  minimap.addEventListener('click', (e) => {
    const r = minimap.getBoundingClientRect();
    view.moveTo(((e.clientX - r.left) / r.width) * view.layout.totalWidth - stage.clientWidth / 2);
  });

  // deep links: #x=<px> or #at=<segmentId>
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('at')) view.jumpToSegment(hash.get('at')!);
  else if (hash.get('x')) view.moveTo(Number(hash.get('x')), false);

  // controls
  root.querySelector<HTMLSelectElement>('#scale')!.addEventListener('change', (e) => {
    scale = Number((e.target as HTMLSelectElement).value);
    view.setScale(scale);
    buildMinimap();
    const params = new URLSearchParams(location.search);
    params.set('scale', String(scale));
    history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
  });
  root.querySelector<HTMLSelectElement>('#jump')!.addEventListener('change', (e) => {
    const id = (e.target as HTMLSelectElement).value;
    if (id) view.jumpToSegment(id);
    stage.focus({ preventScroll: true });
  });
  jumpButtons.forEach((b) => b.addEventListener('click', () => { view.jumpToSegment(b.dataset.jump!); stage.focus({ preventScroll: true }); }));
  const playBtn = root.querySelector<HTMLButtonElement>('#play')!;
  const speedSel = root.querySelector<HTMLSelectElement>('#speed')!;
  const updatePlay = () => {
    const on = view.autoScrolling;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.textContent = on ? `⏸ ${t('scroll.pause')}` : `▶ ${t('scroll.play')}`;
  };
  playBtn.addEventListener('click', () => {
    view.setAutoScroll(view.autoScrolling ? 0 : Number(speedSel.value));
    updatePlay();
  });
  speedSel.addEventListener('change', () => { if (view.autoScrolling) view.setAutoScroll(Number(speedSel.value)); });
  const playPoll = window.setInterval(updatePlay, 500);
  root.querySelector<HTMLButtonElement>('#share')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const url = `${location.origin}${location.pathname}${location.search}#x=${Math.round(view.x)}`;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = t('scroll.shared');
      setTimeout(() => (btn.textContent = t('scroll.share')), 1500);
    } catch {
      prompt(t('scroll.share'), url);
    }
  });

  return () => {
    clearInterval(playPoll);
    view.dispose();
  };
}
