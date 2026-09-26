/**
 * The horizontal strip: a canvas for the bars plus a DOM overlay for labels and
 * text boxes. It has no input handling of its own: the page drives it with setX()
 * from the normal vertical scroll position (sticky stage inside a tall wrapper),
 * so wheel, touch, keyboard and the browser scrollbar all just work.
 */
import { buildLayout, itemAt, moneyAt, tickStep, visible, xAtMoney, type Layout, type LaidOut, type Segment } from './engine';

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
  segments: Segment[];
  /** Money per pixel of width (= 1,000 × bar height for the 1 px² = 1,000 scale). */
  scale: number;
  gap: number;
  /** Vertical space above and below the bar inside the stage. */
  barTop: number;
  barHeight: number;
  markers: Marker[];
  labelFor: (item: LaidOut) => string;
  colorFor: (item: LaidOut) => string;
  formatMoney: (v: number) => string;
  onMove: (state: { x: number; money: number; item: LaidOut | null }) => void;
}

export class StripView {
  layout: Layout;
  x = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLDivElement;
  private ruler: HTMLDivElement;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private markerEls = new Map<string, HTMLDivElement>();
  private markerRows = new Map<string, number>();
  private labelEls = new Map<string, HTMLDivElement>();
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
    this.ruler.className = 'scale-ruler';
    stage.append(this.canvas, this.overlay, this.ruler);
    this.assignRows();
    this.resize();
  }

  /** Spread text boxes that sit close together over two rows so they do not overlap. */
  private assignRows(): void {
    this.markerRows.clear();
    const minGap = 400;
    for (const kind of ['marker', 'objection'] as const) {
      const placed: { x: number; row: number }[] = [];
      const list = this.opts.markers
        .filter((m) => m.kind === kind)
        .map((m) => ({ m, x: this.markerX(m) }))
        .filter((e): e is { m: Marker; x: number } => e.x !== null)
        .sort((a, b) => a.x - b.x);
      for (const { m, x } of list) {
        const near = placed.filter((p) => x - p.x < minGap);
        let row = 0;
        while (near.some((p) => p.row === row)) row++;
        placed.push({ x, row });
        this.markerRows.set(m.id, row);
      }
    }
  }

  get viewportWidth(): number {
    return this.opts.stage.clientWidth;
  }

  /** Largest x that still shows the end of the strip. */
  get maxX(): number {
    return Math.max(0, this.layout.totalWidth - this.viewportWidth + 48);
  }

  /** Rebuild with new geometry (e.g. after a resize); keeps the money position. */
  relayout(scale: number, barTop: number, barHeight: number): void {
    const money = moneyAt(this.layout, this.x);
    this.opts.scale = scale;
    this.opts.barTop = barTop;
    this.opts.barHeight = barHeight;
    this.layout = buildLayout(this.opts.segments, scale, this.opts.gap);
    this.overlay.innerHTML = '';
    this.markerEls.clear();
    this.labelEls.clear();
    this.assignRows();
    this.setX(xAtMoney(this.layout, money) ?? 0);
  }

  setX(x: number): void {
    this.x = Math.min(this.maxX, Math.max(0, x));
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
    const w = this.viewportWidth;
    const h = this.opts.stage.clientHeight;
    const ctx = this.ctx;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    ctx.fillRect(0, 0, w, h);

    const { barTop, barHeight } = this.opts;
    const items = visible(this.layout, this.x, w);
    for (const it of items) {
      const left = Math.max(-1, it.x0 - this.x);
      const right = Math.min(w + 1, it.x1 - this.x);
      ctx.fillStyle = this.opts.colorFor(it);
      ctx.fillRect(left, barTop, Math.max(1, right - left), barHeight);
    }

    // ruler (money ticks)
    const { px, money } = tickStep(this.layout.scale);
    const first = Math.floor(this.x / px) * px;
    const ticks: string[] = [];
    for (let tx = first; tx <= this.x + w; tx += px) {
      const screen = tx - this.x;
      if (screen < 0) continue;
      ticks.push(`<span style="left:${screen}px">${this.opts.formatMoney(Math.round(tx / px) * money)}</span>`);
    }
    this.ruler.innerHTML = ticks.join('');
    this.ruler.style.top = `${barTop + barHeight + 4}px`;

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
      el.style.top = `${barTop + 16}px`;
      const left = Math.max(12, it.x0 - this.x + 12);
      const maxLeft = it.x1 - this.x - el.offsetWidth - 12;
      el.style.left = `${Math.max(Math.min(left, maxLeft), Math.min(12, it.x0 - this.x + 12))}px`;
    }
    for (const [id, el] of this.labelEls) {
      if (!seen.has(id)) {
        el.remove();
        this.labelEls.delete(id);
      }
    }

    // text boxes along the bar
    for (const m of this.opts.markers) {
      const pos = this.markerX(m);
      if (pos === null) continue;
      const screen = pos - this.x;
      const el = this.markerEls.get(m.id);
      const width = Math.min(360, w * 0.86);
      if (screen > -width - 20 && screen < w + 40) {
        let node = el;
        if (!node) {
          node = document.createElement('div');
          node.className = `marker ${m.kind}`;
          node.innerHTML = m.html + '<span class="tick" aria-hidden="true"></span>';
          this.overlay.appendChild(node);
          this.markerEls.set(m.id, node);
        }
        node.style.left = `${Math.min(screen, w - width - 8)}px`;
        const row = this.markerRows.get(m.id) ?? 0;
        node.style.top = m.kind === 'objection' ? `${barTop + barHeight * 0.22 + row * 40}px` : `${barTop + barHeight * (0.5 + row * 0.19)}px`;
      } else if (el) {
        el.remove();
        this.markerEls.delete(m.id);
      }
    }

    this.opts.onMove({ x: this.x, money: moneyAt(this.layout, this.x), item: itemAt(this.layout, this.x + Math.min(200, w / 2)) });
  }

  markerX(m: Marker): number | null {
    if (m.money !== undefined) return xAtMoney(this.layout, m.money);
    if (m.at) {
      const it = this.layout.items.find((i) => i.id === m.at!.segmentId);
      if (!it) return null;
      return Math.min(it.x1, it.x0 + m.at.offset);
    }
    return null;
  }
}
