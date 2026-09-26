/**
 * The strip: a canvas for the bars plus a DOM overlay for labels and text boxes.
 * It can run along the x axis (desktop: a horizontal scroll container) or the
 * y axis (phones: the page itself scrolls down along the bar). It has no input
 * handling of its own: the page calls setPos() from the relevant scroll offset.
 */
import { buildLayout, itemAt, moneyAt, tickStep, visible, xAtMoney, type Layout, type LaidOut, type Segment } from './engine';

export type Axis = 'x' | 'y';

export interface Marker {
  id: string;
  /** Money threshold at which the marker sits. */
  money?: number;
  /** Or a pixel offset from the start of a segment's bar. */
  at?: { segmentId: string; offset: number };
  html: string;
  kind: 'marker' | 'objection';
}

export interface StripOptions {
  stage: HTMLElement;
  axis: Axis;
  segments: Segment[];
  /** Money per pixel along the axis (= 1,000 × bar thickness for the 1 px² = 1,000 scale). */
  scale: number;
  gap: number;
  /** Offset of the bar across the axis (top margin for x, left margin for y). */
  crossStart: number;
  /** Bar thickness across the axis. */
  crossSize: number;
  markers: Marker[];
  labelFor: (item: LaidOut) => string;
  colorFor: (item: LaidOut) => string;
  formatMoney: (v: number) => string;
  onMove: (state: { pos: number; money: number; item: LaidOut | null }) => void;
}

export class StripView {
  layout: Layout;
  pos = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLDivElement;
  private ruler: HTMLDivElement;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private markerEls = new Map<string, HTMLDivElement>();
  private labelEls = new Map<string, HTMLDivElement>();
  /** Display position of each marker along the axis (after de-overlapping) and its row across. */
  private markerPlace = new Map<string, { along: number; row: number }>();
  private opts: StripOptions;

  constructor(opts: StripOptions) {
    this.opts = opts;
    this.layout = buildLayout(opts.segments, opts.scale, opts.gap);
    const stage = opts.stage;
    stage.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.overlay = document.createElement('div');
    this.overlay.className = 'strip-overlay';
    this.ruler = document.createElement('div');
    this.ruler.className = `scale-ruler axis-${opts.axis}`;
    stage.append(this.canvas, this.overlay, this.ruler);
    this.placeMarkers();
    this.resize();
  }

  get axis(): Axis {
    return this.opts.axis;
  }

  /** Visible length along the axis. */
  get viewportLength(): number {
    return this.opts.axis === 'x' ? this.opts.stage.clientWidth : this.opts.stage.clientHeight;
  }

  /** Largest position that still shows the end of the strip. */
  get maxPos(): number {
    return Math.max(0, this.layout.totalWidth - this.viewportLength + 48);
  }

  /**
   * Along the x axis, boxes that sit close together go into two rows; along the y axis
   * there is no room for rows on a phone, so later boxes are pushed further along instead.
   */
  private placeMarkers(): void {
    this.markerPlace.clear();
    const list = this.opts.markers
      .map((m) => ({ m, along: this.naturalPos(m) }))
      .filter((e): e is { m: Marker; along: number } => e.along !== null)
      .sort((a, b) => a.along - b.along);
    if (this.opts.axis === 'x') {
      for (const kind of ['marker', 'objection'] as const) {
        const placed: { along: number; row: number }[] = [];
        for (const { m, along } of list.filter((e) => e.m.kind === kind)) {
          const near = placed.filter((p) => along - p.along < 400);
          let row = 0;
          while (near.some((p) => p.row === row)) row++;
          placed.push({ along, row });
          this.markerPlace.set(m.id, { along, row });
        }
      }
    } else {
      let next = 0;
      for (const { m, along } of list) {
        const at = Math.max(along, next);
        this.markerPlace.set(m.id, { along: at, row: 0 });
        next = at + (m.kind === 'objection' ? 340 : 150);
      }
    }
  }

  private naturalPos(m: Marker): number | null {
    if (m.money !== undefined) return xAtMoney(this.layout, m.money);
    if (m.at) {
      const it = this.layout.items.find((i) => i.id === m.at!.segmentId);
      if (!it) return null;
      return Math.min(it.x1, it.x0 + m.at.offset);
    }
    return null;
  }

  /** Rebuild with new geometry (after a resize); keeps the money position. */
  relayout(scale: number, crossStart: number, crossSize: number): void {
    const money = moneyAt(this.layout, this.pos);
    this.opts.scale = scale;
    this.opts.crossStart = crossStart;
    this.opts.crossSize = crossSize;
    this.layout = buildLayout(this.opts.segments, scale, this.opts.gap);
    this.overlay.innerHTML = '';
    this.markerEls.clear();
    this.labelEls.clear();
    this.placeMarkers();
    this.setPos(xAtMoney(this.layout, money) ?? 0);
  }

  setPos(p: number): void {
    this.pos = Math.min(this.maxPos, Math.max(0, p));
    this.render();
  }

  resize(): void {
    const w = this.opts.stage.clientWidth;
    const h = this.opts.stage.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  dispose(): void {
    this.overlay.innerHTML = '';
  }

  render(): void {
    const w = this.opts.stage.clientWidth;
    const h = this.opts.stage.clientHeight;
    const horizontal = this.opts.axis === 'x';
    const len = this.viewportLength;
    const ctx = this.ctx;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    ctx.fillRect(0, 0, w, h);

    const { crossStart, crossSize } = this.opts;
    const items = visible(this.layout, this.pos, len);
    for (const it of items) {
      const a0 = Math.max(-1, it.x0 - this.pos);
      const a1 = Math.min(len + 1, it.x1 - this.pos);
      ctx.fillStyle = this.opts.colorFor(it);
      if (horizontal) ctx.fillRect(a0, crossStart, Math.max(1, a1 - a0), crossSize);
      else ctx.fillRect(crossStart, a0, crossSize, Math.max(1, a1 - a0));
    }

    // ruler with money ticks
    const { px, money } = tickStep(this.layout.scale, horizontal ? 180 : 140);
    const first = Math.floor(this.pos / px) * px;
    const ticks: string[] = [];
    for (let tx = first; tx <= this.pos + len; tx += px) {
      const screen = tx - this.pos;
      if (screen < 0) continue;
      ticks.push(`<span style="${horizontal ? 'left' : 'top'}:${screen}px">${this.opts.formatMoney(Math.round(tx / px) * money)}</span>`);
    }
    this.ruler.innerHTML = ticks.join('');
    if (horizontal) this.ruler.style.cssText = `top:${crossStart + crossSize + 4}px;left:0;right:0`;
    else this.ruler.style.cssText = `left:${crossStart + crossSize + 4}px;top:0;bottom:0`;

    // sticky labels inside each bar
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.id);
      let el = this.labelEls.get(it.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'seg-label';
        el.innerHTML = this.opts.labelFor(it);
        this.overlay.appendChild(el);
        this.labelEls.set(it.id, el);
      }
      const size = horizontal ? el.offsetWidth : el.offsetHeight;
      const start = Math.max(12, it.x0 - this.pos + 12);
      const maxStart = it.x1 - this.pos - size - 12;
      const along = Math.max(Math.min(start, maxStart), Math.min(12, it.x0 - this.pos + 12));
      if (horizontal) {
        el.style.top = `${crossStart + 16}px`;
        el.style.left = `${along}px`;
        el.style.maxWidth = '';
      } else {
        el.style.left = `${crossStart + 12}px`;
        el.style.top = `${along}px`;
        el.style.maxWidth = `${crossSize - 24}px`;
      }
    }
    for (const [id, el] of this.labelEls) {
      if (!seen.has(id)) {
        el.remove();
        this.labelEls.delete(id);
      }
    }

    // text boxes along the bar
    for (const m of this.opts.markers) {
      const place = this.markerPlace.get(m.id);
      if (!place) continue;
      const screen = place.along - this.pos;
      const el = this.markerEls.get(m.id);
      const boxAlong = horizontal ? Math.min(360, w * 0.86) : 400;
      if (screen > -boxAlong - 20 && screen < len + 40) {
        let node = el;
        if (!node) {
          node = document.createElement('div');
          node.className = `marker ${m.kind}`;
          node.innerHTML = m.html + '<span class="tick" aria-hidden="true"></span>';
          this.overlay.appendChild(node);
          this.markerEls.set(m.id, node);
        }
        if (horizontal) {
          node.style.left = `${Math.min(screen, w - Math.min(360, w * 0.86) - 8)}px`;
          node.style.top = m.kind === 'objection' ? `${crossStart + crossSize * 0.22 + place.row * 40}px` : `${crossStart + crossSize * (0.5 + place.row * 0.19)}px`;
          node.style.width = '';
        } else {
          node.style.top = `${screen}px`;
          node.style.left = `${crossStart + 12}px`;
          node.style.width = `${crossSize - 24}px`;
        }
      } else if (el) {
        el.remove();
        this.markerEls.delete(m.id);
      }
    }

    this.opts.onMove({ pos: this.pos, money: moneyAt(this.layout, this.pos), item: itemAt(this.layout, this.pos + Math.min(200, len / 2)) });
  }
}
