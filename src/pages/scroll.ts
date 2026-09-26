/**
 * Home page, after Matt Korostoff's original: blocks drawn to scale (1 px² = 1,000),
 * first stacked vertically, then, when a fortune no longer fits, a strip that scrolls
 * sideways while you keep scrolling down. Only the largest German fortune and the
 * largest fortune on Earth are drawn; the rice and spend chapters follow on the same page.
 */
import { currentLanguage, t } from '../i18n';
import { convert, getCurrency, getData, inDisplay } from '../data';
import { escapeHtml, money, number } from '../format';
import { num } from '../ui/source';
import { staleBanner } from '../ui/layout';
import { pathFor } from '../router';
import { StripView, type Marker } from '../scroll/view';
import type { Segment, LaidOut } from '../scroll/engine';
import { render as renderRice } from './rice';
import { render as renderSpend } from './spend';
import type { SourcedValue } from '../data/types';

/** Money represented by one pixel of area. */
export const UNIT = 1000;
const GAP = 96;
const BAR_MARGIN_TOP = 84;
const BAR_MARGIN_BOTTOM = 96;

/** A block of `value` money as a rectangle whose area is value / UNIT pixels, at most maxWidth wide. */
export function blockSize(value: number, maxWidth: number): { w: number; h: number } {
  const area = value / UNIT;
  const side = Math.sqrt(area);
  if (side <= maxWidth) return { w: side, h: side };
  return { w: maxWidth, h: area / maxWidth };
}

export function render(root: HTMLElement): () => void {
  const d = getData();
  const cur = getCurrency();
  const lang = currentLanguage().code;
  const ref = d.reference.values;
  const dist = d.distribution.values;
  const de1 = d.wealth_germany.people[0];
  const world1 = d.wealth_world.people[0];
  const fm = (v: number) => money(v, cur);
  const v = (s: SourcedValue) => inDisplay(s, cur);

  // ---- vertical blocks ---------------------------------------------------------
  const maxBlockWidth = Math.max(200, Math.min(1000, root.clientWidth - 32));
  const block = (id: string, label: string, value: number, cls = '') => {
    const { w, h } = blockSize(value, maxBlockWidth);
    return `<div class="block-item" id="b-${id}"><p>${label}</p><div class="block ${cls}" style="width:${Math.max(1, w)}px;height:${Math.max(1, h)}px" role="img" aria-label="${escapeHtml(money(value, cur, { compact: false }))}"></div></div>`;
  };
  const blocks = [
    block('thousand', `${escapeHtml(t('scroll.thousand', { money: money(UNIT, cur, { compact: false }) }))}<br><span class="muted small">${escapeHtml(t('scroll.thousandNote'))}</span>`, UNIT),
    block('median_income', t('scroll.medianIncome', { value: num(ref.de_median_gross_annual_fulltime, { label: t('scroll.labels.median_income_de') }) }), v(ref.de_median_gross_annual_fulltime)),
    block('median_wealth', t('scroll.medianWealth', { value: num(ref.de_median_net_wealth_household, { label: t('scroll.labels.median_wealth_de') }) }), v(ref.de_median_net_wealth_household)),
    block('million', t('scroll.million', { value: escapeHtml(money(1_000_000, cur, { compact: false })) }), 1_000_000, 'million'),
    block('lifetime', t('scroll.lifetime', { value: num(ref.de_lifetime_earnings_median_derived, { label: t('scroll.labels.lifetime_de') }) }), v(ref.de_lifetime_earnings_median_derived)),
    block('billion', t('scroll.billion', { value: escapeHtml(money(1_000_000_000, cur, { compact: false })) }), 1_000_000_000, 'billion'),
  ].join('');

  // ---- strip segments ------------------------------------------------------------
  const segments: Segment[] = [
    { id: 'de1', value: v(de1.wealth), kind: 'germany' },
    { id: 'world1', value: v(world1.wealth), kind: 'world' },
  ];
  const deValue = segments[0].value;
  const worldValue = segments[1].value;

  const objLink = (id: string) => `<a href="${pathFor(lang, 'objections')}#${id}">${escapeHtml(t('scroll.readFull'))}</a>`;
  const obj = (key: string, at: Marker['at'], params: Record<string, string | number> = {}): Marker => ({
    id: `obj-${key}`,
    at,
    kind: 'objection',
    html: `<h4>${escapeHtml(t('scroll.objectionCard'))}</h4><p><strong>${escapeHtml(t(`objections.items.${key}.title`))}</strong></p><p>${escapeHtml(t(`objections.items.${key}.core`, params))}</p><p>${objLink(key)}</p>`,
  });
  const mk = (id: string, moneyAt: number, text: string): Marker => ({ id, money: moneyAt, kind: 'marker', html: `<p>${text}</p>` });
  const price = (id: string) => v(d.prices.items.find((i) => i.id === id)!.price);
  const medianIncome = v(ref.de_median_gross_annual_fulltime);
  const medianWealth = v(ref.de_median_net_wealth_household);
  const lifetime = v(ref.de_lifetime_earnings_median_derived);
  const bottom50 = (v(ref.de_total_household_net_wealth) * dist.de_bottom50_net_wealth_share.value) / 100;
  const schwarzMM = de1.wealth.alt_sources?.find((a) => a.source.includes('Manager'));

  const markers: Marker[] = [
    mk('m-median1000', medianIncome * 1000, t('scroll.markers.median1000', { money: fm(medianIncome * 1000) })),
    mk('m-eurojackpot', v(ref.eurojackpot_max), t('scroll.markers.eurojackpot', { money: num(ref.eurojackpot_max, { label: t('scroll.markers.eurojackpotLabel') }) })),
    mk('m-lifetime100', lifetime * 100, t('scroll.markers.lifetime100', { money: fm(lifetime * 100) })),
    mk('m-powerball', v(ref.powerball_record_jackpot), t('scroll.markers.powerball', { money: num(ref.powerball_record_jackpot, { label: t('scroll.markers.powerballLabel') }) })),
    mk('m-households', medianWealth * 100_000, t('scroll.markers.medianHouseholds', { money: fm(medianWealth * 100_000), n: number(100_000) })),
    mk('m-hunger', price('end_hunger_year'), t('scroll.markers.endHunger', { money: fm(price('end_hunger_year')) })),
    mk('m-schools', price('school_investment_backlog_de'), t('scroll.markers.schoolBacklog', { money: fm(price('school_investment_backlog_de')) })),
    mk('m-bottom50', bottom50, t('scroll.markers.bottom50', { money: fm(bottom50), share: `${number(dist.de_bottom50_net_wealth_share.value, 1)} %`, total: fm(v(ref.de_total_household_net_wealth)) })),
    mk('m-budget', v(ref.de_federal_budget_2026), t('scroll.markers.federalBudget', { money: fm(v(ref.de_federal_budget_2026)) })),
    obj('valuation', { segmentId: 'de1', offset: 420 }, {
      schwarzForbes: fm(deValue),
      schwarzMM: schwarzMM ? fm(convert(schwarzMM.value, schwarzMM.currency ?? 'EUR', cur)) : '',
    }),
    obj('mittelstand', { segmentId: 'de1', offset: 9000 }, { exempt: fm(v(dist.de_inheritance_tax_exempt_business_2024)) }),
    obj('leave', { segmentId: 'de1', offset: 30000 }, { norwayLeavers: number(dist.norway_wealth_tax_leavers_2022_2023.value) }),
    obj('paper', { segmentId: 'world1', offset: 420 }, { topWealth: fm(worldValue) }),
    obj('earned', { segmentId: 'world1', offset: 12000 }),
    obj('zerosum', { segmentId: 'world1', offset: 90000 }, { bottom50: `${number(dist.de_bottom50_net_wealth_share.value, 1)} %` }),
    obj('twopercent', { segmentId: 'world1', offset: 400000 }, { taxShare: `${number(dist.de_top10_income_tax_share.value)} %` }),
  ];

  root.innerHTML = `
    <section class="blocks">
      <h1>${escapeHtml(t('pages.scroll.title'))}</h1>
      <p class="small muted credit-line">${t('intro.credit', { creditsLink: `<a href="${pathFor(lang, 'credits')}">${escapeHtml(t('intro.creditsLinkText'))}</a>` })}</p>
      ${staleBanner([ref.de_median_gross_annual_fulltime, ref.de_median_net_wealth_household, ref.de_lifetime_earnings_median_derived, de1.wealth, world1.wealth])}
      ${blocks}
      <div class="block-item"><p>${t('scroll.germanyIntro', { name: escapeHtml(de1.name), value: num(de1.wealth, { label: de1.name }) })}</p></div>
    </section>
    <div class="strip-wrap" id="strip">
      <div class="strip-stage" id="stage" role="region" aria-label="${escapeHtml(t('scroll.regionLabel'))}">
      </div>
      <div class="strip-hud" aria-hidden="true">
        <div class="counter"><span id="counter">${escapeHtml(money(0, cur))}</span><small>${escapeHtml(t('scroll.counter'))}</small></div>
        <div class="minimap" id="minimap"></div>
      </div>
    </div>
    <p class="sr-only" id="live" aria-live="polite"></p>
    <section class="after" id="end">
      <h2>${escapeHtml(t('scroll.end.title'))}</h2>
      <p id="end-text"></p>
    </section>
    <section class="after" id="rice"></section>
    <section class="after" id="spend"></section>
    <section class="after chapters">
      <h2>${escapeHtml(t('scroll.more'))}</h2>
      <ul>
        <li><a href="${pathFor(lang, 'germany')}">${escapeHtml(t('pages.germany.title'))}</a></li>
        <li><a href="${pathFor(lang, 'taxes')}">${escapeHtml(t('pages.taxes.title'))}</a></li>
        <li><a href="${pathFor(lang, 'objections')}">${escapeHtml(t('pages.objections.title'))}</a></li>
        <li><a href="${pathFor(lang, 'methodology')}">${escapeHtml(t('pages.methodology.title'))}</a></li>
      </ul>
    </section>
  `;

  const wrap = root.querySelector<HTMLElement>('#strip')!;
  const stage = root.querySelector<HTMLElement>('#stage')!;
  const counter = root.querySelector<HTMLElement>('#counter')!;
  const live = root.querySelector<HTMLElement>('#live')!;
  const minimap = root.querySelector<HTMLElement>('#minimap')!;
  const endText = root.querySelector<HTMLElement>('#end-text')!;

  const css = getComputedStyle(document.documentElement);
  const colors: Record<string, string> = {
    germany: css.getPropertyValue('--bar-de').trim(),
    world: css.getPropertyValue('--bar-world').trim(),
  };

  function labelFor(it: LaidOut): string {
    if (it.id === 'de1') {
      const fam = de1.is_family ? `<span class="badge">${escapeHtml(t('common.family'))}</span>` : '';
      return `<strong>${escapeHtml(t('scroll.bar.germany', { name: de1.name }))}${fam}</strong>${num(de1.wealth, { label: de1.name })}<br><span class="muted small">${escapeHtml(de1.source_of_wealth)}</span>`;
    }
    return `<strong>${escapeHtml(t('scroll.bar.world', { name: world1.name }))}</strong>${num(world1.wealth, { label: world1.name })}<br><span class="muted small">${escapeHtml(t('scroll.worldIntro', { deName: de1.name, ratio: number(worldValue / deValue, 1) }))}</span>`;
  }

  const geometry = () => {
    const h = Math.max(240, stage.clientHeight - BAR_MARGIN_TOP - BAR_MARGIN_BOTTOM);
    return { barTop: BAR_MARGIN_TOP, barHeight: h, scale: UNIT * h };
  };
  let g = geometry();
  let lastAnnounced = '';
  let announceTimer = 0;
  let hashTimer = 0;

  let view: StripView | undefined;
  view = new StripView({
    stage,
    segments,
    scale: g.scale,
    gap: GAP,
    barTop: g.barTop,
    barHeight: g.barHeight,
    markers,
    labelFor,
    colorFor: (it) => colors[it.kind] ?? colors.world,
    formatMoney: (x) => money(x, cur),
    onMove: ({ x, money: m, item }) => {
      if (!view) return;
      counter.textContent = money(m, cur, { compact: m >= 1e6 });
      const viewEl = minimap.querySelector<HTMLElement>('.mm-view');
      const total = view.layout.totalWidth || 1;
      if (viewEl) {
        viewEl.style.left = `${(x / total) * 100}%`;
        viewEl.style.width = `${Math.max(0.5, (stage.clientWidth / total) * 100)}%`;
      }
      const label = item ? (item.id === 'de1' ? de1.name : world1.name) : '';
      if (label !== lastAnnounced) {
        lastAnnounced = label;
        clearTimeout(announceTimer);
        announceTimer = window.setTimeout(() => {
          live.textContent = `${t('scroll.nowAt', { label })} ${t('scroll.counterAria', { money: money(m, cur) })}`;
        }, 400);
      }
      clearTimeout(hashTimer);
      hashTimer = window.setTimeout(() => {
        const h = x > 0 ? `#x=${Math.round(x)}` : '';
        if (location.hash !== h) history.replaceState(null, '', `${location.pathname}${location.search}${h}`);
      }, 250);
    },
  });

  const buildMinimap = () => {
    const total = view!.layout.totalWidth || 1;
    minimap.innerHTML =
      view!.layout.items
        .map((it) => `<div class="mm-seg" style="left:${(it.x0 / total) * 100}%;width:${Math.max(0.15, ((it.x1 - it.x0) / total) * 100)}%;background:${colors[it.kind]}"></div>`)
        .join('') + '<div class="mm-view"></div>';
  };
  const sizeWrapper = () => {
    wrap.style.height = `calc(100vh + ${Math.round(view!.maxX)}px)`;
  };
  buildMinimap();
  sizeWrapper();
  endText.textContent = t('scroll.end.text', { money: money(view.layout.totalMoney, cur), px: number(Math.round(view.layout.totalWidth * g.barHeight)) });

  // The vertical scroll position drives the horizontal position of the strip.
  let ticking = false;
  const sync = () => {
    ticking = false;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    view!.setX(window.scrollY - top);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(sync);
    }
  };
  const onResize = () => {
    g = geometry();
    view!.resize();
    view!.relayout(g.scale, g.barTop, g.barHeight);
    buildMinimap();
    sizeWrapper();
    sync();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // deep link: #x=<px>
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('x')) {
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + Number(hash.get('x')), behavior: 'auto' });
  }
  sync();

  // Keyboard: arrows move sideways when the stage has focus (Page keys and space keep native behaviour).
  stage.tabIndex = 0;
  const onKey = (e: KeyboardEvent) => {
    if (document.activeElement !== stage) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      window.scrollBy({ top: (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1000 : 120), behavior: 'auto' });
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKey);

  // The rice and spend chapters follow on the same page.
  const cleanRice = renderRice(root.querySelector<HTMLElement>('#rice')!, { embedded: true });
  const cleanSpend = renderSpend(root.querySelector<HTMLElement>('#spend')!, { embedded: true });

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    view?.dispose();
    cleanRice();
    cleanSpend();
  };
}
