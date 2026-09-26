/**
 * The interactive stage: canvas for bars, DOM overlay for labels and cards,
 * wheel / keyboard / pointer / autoscroll input, URL deep links.
 */
import { buildLayout, clampX, itemAt, moneyAt, tickStep, visible, xAtMoney, type Layout, type LaidOut, type Segment } from './engine';

export interface Marker {
  id: string;
  /** Money threshold at which the marker appears. */
  money?: number;
  /** Or a pixel offset from the start of a segment's bar. */
  at?: { segmentId: string; offset: number };
  html: string;
  kind: 'marker' | 'objection';
}

export interface ViewOptions {
  stage: HTMLElement;
  segments: Segment[];
  scale: number;
  gap?: number;
  markers: Marker[];
  labelFor: (item: LaidOut) => string;
  sectionFor: (item: LaidOut) => string | null;
  colorFor: (item: LaidOut) => string;
  formatMoney: (v: number) => string;
  onMove: (state: { x: number; money: number; item: LaidOut | null; progress: number }) => void;
  reducedMotion: boolean;
}

export class ScrollView {
  layout: Layout;
  x = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLDivElement;
  private ruler: HTMLDivElement;
  private raf = 0;
  private velocity = 0;
  private autoSpeed = 0; // px per second
  private lastFrame = 0;
  private dragging = false;
  private dragStartX = 0;
  private dragStartPos = 0;
  private lastPointerX = 0;
  private lastPointerT = 0;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private markerEls = new Map<string, HTMLDivElement>();
  private labelEls = new Map<string, HTMLDivElement>();
  private sectionEls = new Map<string, HTMLDivElement>();
  private disposed = false;
  private opts: ViewOptions;

  constructor(opts: ViewOptions) {
    this.opts = opts;
    this.layout = buildLayout(opts.segments, opts.scale, opts.gap ?? 48);
    const stage = opts.stage;
    stage.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.overlay = document.createElement('div');
    this.overlay.className = 'scroll-overlay';
    this.ruler = document.createElement('div');
    this.ruler.className = 'scale-ruler';
    stage.append(this.canvas, this.overlay, this.ruler);
    this.resize();
    this.bind();
    this.render();
  }

  get viewportWidth(): number {
    return this.opts.stage.clientWidth;
  }

  setScale(scale: number): void {
    const money = moneyAt(this.layout, this.x);
    this.layout = buildLayout(this.opts.segments, scale, this.layout.gap);
    this.x = clampX(this.layout, xAtMoney(this.layout, money) ?? 0, this.viewportWidth);
    this.overlay.innerHTML = '';
    this.markerEls.clear();
    this.labelEls.clear();
    this.sectionEls.clear();
    this.render();
  }

  moveTo(x: number, animate = true): void {
    const target = clampX(this.layout, x, this.viewportWidth);
    if (!animate || this.opts.reducedMotion || Math.abs(target - this.x) < 2) {
      this.velocity = 0;
      this.x = target;
      this.render();
      return;
    }
    // Ease toward the target over ~500 ms.
    const start = this.x;
    const t0 = performance.now();
    const dur = 500;
    const step = (t: number) => {
      if (this.disposed) return;
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      this.x = start + (target - start) * e;
      this.render();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  moveBy(dx: number): void {
    this.velocity = 0;
    this.x = clampX(this.layout, this.x + dx, this.viewportWidth);
    this.render();
  }

  jumpToSegment(id: string): void {
    const it = this.layout.items.find((i) => i.id === id);
    if (it) this.moveTo(Math.max(0, it.x0 - 24));
  }

  setAutoScroll(pxPerSecond: number): void {
    this.autoSpeed = pxPerSecond;
    if (pxPerSecond > 0) this.loop();
  }

  get autoScrolling(): boolean {
    return this.autoSpeed > 0;
  }

  resize(): void {
    const w = this.opts.stage.clientWidth;
    const h = this.opts.stage.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.x = clampX(this.layout, this.x, w);
    this.render();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
  }

  private onResize = () => this.resize();

  private onKey = (e: KeyboardEvent) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
    if (!this.opts.stage.contains(active) && active !== this.opts.stage) return;
    const vw = this.viewportWidth;
    const big = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowRight': this.moveBy(80 * big); break;
      case 'ArrowLeft': this.moveBy(-80 * big); break;
      case 'PageDown': this.moveBy(vw * 0.9); break;
      case 'PageUp': this.moveBy(-vw * 0.9); break;
      case 'Home': this.moveTo(0); break;
      case 'End': this.moveTo(this.layout.totalWidth); break;
      case ' ': this.setAutoScroll(this.autoSpeed > 0 ? 0 : 240); break;
      default: return;
    }
    e.preventDefault();
  };

  private bind(): void {
    const stage = this.opts.stage;
    stage.tabIndex = 0;
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);

    stage.addEventListener(
      'wheel',
      (e) => {
        // Vertical wheel scrolls horizontally; trackpads give deltaX directly.
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.viewportWidth : 1;
        this.autoSpeed = 0;
        this.moveBy(dx * factor * (e.shiftKey ? 5 : 1));
        e.preventDefault();
      },
      { passive: false },
    );

    stage.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      this.dragging = true;
      this.autoSpeed = 0;
      this.velocity = 0;
      this.dragStartX = e.clientX;
      this.dragStartPos = this.x;
      this.lastPointerX = e.clientX;
      this.lastPointerT = performance.now();
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - this.lastPointerT);
      this.velocity = ((this.lastPointerX - e.clientX) / dt) * 1000; // px/s
      this.lastPointerX = e.clientX;
      this.lastPointerT = now;
      this.x = clampX(this.layout, this.dragStartPos + (this.dragStartX - e.clientX), this.viewportWidth);
      this.render();
    });
    const endDrag = () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.opts.reducedMotion && Math.abs(this.velocity) > 50) this.loop();
      else this.velocity = 0;
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
  }

  /** Animation loop for momentum and auto-scroll. */
  private loop(): void {
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    const step = (t: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (t - this.lastFrame) / 1000);
      this.lastFrame = t;
      let dx = 0;
      if (this.autoSpeed > 0) dx += this.autoSpeed * dt;
      if (Math.abs(this.velocity) > 20) {
        dx += this.velocity * dt;
        this.velocity *= Math.pow(0.15, dt); // friction
      } else this.velocity = 0;
      if (dx !== 0) {
        const before = this.x;
        this.x = clampX(this.layout, this.x + dx, this.viewportWidth);
        if (this.x === before && this.autoSpeed > 0) this.autoSpeed = 0; // reached the end
        this.render();
      }
      if (this.autoSpeed > 0 || this.velocity !== 0) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  render(): void {
    const w = this.viewportWidth;
    const h = this.opts.stage.clientHeight;
    const ctx = this.ctx;
    const styles = getComputedStyle(this.opts.stage);
    ctx.fillStyle = styles.backgroundColor || '#fff';
    ctx.fillRect(0, 0, w, h);

    // bars
    const barTop = 70;
    const barHeight = Math.max(80, h - 150);
    const items = visible(this.layout, this.x, w);
    for (const it of items) {
      const left = Math.max(-1, it.x0 - this.x);
      const right = Math.min(w + 1, it.x1 - this.x);
      ctx.fillStyle = this.opts.colorFor(it);
      ctx.fillRect(left, barTop, Math.max(1, right - left), barHeight);
    }

    // ruler
    const { px, money } = tickStep(this.layout.scale);
    const first = Math.floor(this.x / px) * px;
    const ticks: string[] = [];
    for (let tx = first; tx <= this.x + w; tx += px) {
      const screen = tx - this.x;
      if (screen < 0) continue;
      const n = Math.round(tx / px);
      ticks.push(`<span style="left:${screen}px">${this.opts.formatMoney(n * money)}</span>`);
    }
    this.ruler.innerHTML = ticks.join('');

    // labels (DOM), sticky within their bar
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
      const left = Math.max(8, it.x0 - this.x + 8);
      const maxLeft = it.x1 - this.x - el.offsetWidth - 8;
      el.style.left = `${Math.max(Math.min(left, maxLeft), Math.min(8, it.x0 - this.x + 8))}px`;
      const section = this.opts.sectionFor(it);
      if (section) {
        let s = this.sectionEls.get(it.id);
        if (!s) {
          s = document.createElement('div');
          s.className = 'seg-section';
          s.textContent = section;
          this.overlay.appendChild(s);
          this.sectionEls.set(it.id, s);
        }
        s.style.left = `${it.x0 - this.x - 26}px`;
      }
    }
    for (const [id, el] of this.labelEls) {
      if (!seen.has(id)) {
        el.remove();
        this.labelEls.delete(id);
        this.sectionEls.get(id)?.remove();
        this.sectionEls.delete(id);
      }
    }

    // markers
    for (const m of this.opts.markers) {
      const pos = this.markerX(m);
      if (pos === null) continue;
      const screen = pos - this.x;
      const el = this.markerEls.get(m.id);
      const width = 360;
      if (screen > -width && screen < w + 40) {
        let node = el;
        if (!node) {
          node = document.createElement('div');
          node.className = `marker ${m.kind}`;
          node.innerHTML = m.html + '<span class="tick" aria-hidden="true"></span>';
          this.overlay.appendChild(node);
          this.markerEls.set(m.id, node);
        }
        node.style.left = `${Math.min(screen, w - Math.min(width, w * 0.86) - 8)}px`;
      } else if (el) {
        el.remove();
        this.markerEls.delete(m.id);
      }
    }

    const item = itemAt(this.layout, this.x + Math.min(200, w / 2));
    this.opts.onMove({ x: this.x, money: moneyAt(this.layout, this.x), item, progress: this.layout.totalWidth ? this.x / this.layout.totalWidth : 0 });
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
