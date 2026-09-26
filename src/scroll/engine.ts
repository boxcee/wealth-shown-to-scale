/**
 * Pure layout maths for the virtual side-scroll. No DOM here, so it is unit-testable.
 *
 * The strip is a sequence of bars. Bar width = value / scale pixels. Bars are separated
 * by a fixed pixel gap. The visible viewport is [x, x + viewportWidth]; only bars that
 * intersect it are drawn, so the total width may be billions of pixels without any
 * DOM element ever being wider than the viewport.
 */
export interface Segment {
  id: string;
  /** Monetary value in the display currency. */
  value: number;
  kind: 'reference' | 'million' | 'lifetime' | 'world' | 'germany';
  /** Section start marker (rendered as a vertical caption). */
  section?: string;
}

export interface LaidOut extends Segment {
  x0: number;
  x1: number;
  /** Money accumulated before this bar starts. */
  moneyBefore: number;
}

export interface Layout {
  items: LaidOut[];
  totalWidth: number;
  totalMoney: number;
  scale: number;
  gap: number;
}

export function buildLayout(segments: Segment[], scale: number, gap = 48): Layout {
  let x = 0;
  let money = 0;
  const items: LaidOut[] = segments.map((s) => {
    const width = Math.max(1, s.value / scale);
    const item: LaidOut = { ...s, x0: x, x1: x + width, moneyBefore: money };
    x += width + gap;
    money += s.value;
    return item;
  });
  return { items, totalWidth: Math.max(0, x - gap), totalMoney: money, scale, gap };
}

export function clampX(layout: Layout, x: number, viewportWidth: number): number {
  const max = Math.max(0, layout.totalWidth - viewportWidth * 0.5);
  return Math.min(max, Math.max(0, x));
}

/** Money represented by everything left of pixel position x (partial bars pro rata). */
export function moneyAt(layout: Layout, x: number): number {
  let m = 0;
  for (const it of layout.items) {
    if (it.x1 <= x) m = it.moneyBefore + it.value;
    else if (it.x0 < x) return it.moneyBefore + (x - it.x0) * layout.scale;
    else break;
  }
  return m;
}

/** Pixel position at which the accumulated money first reaches m. */
export function xAtMoney(layout: Layout, m: number): number | null {
  for (const it of layout.items) {
    if (it.moneyBefore + it.value >= m) return it.x0 + (m - it.moneyBefore) / layout.scale;
  }
  return null;
}

/** Items intersecting [x, x + w]. Linear scan is fine: a few dozen bars. */
export function visible(layout: Layout, x: number, w: number): LaidOut[] {
  return layout.items.filter((it) => it.x1 >= x && it.x0 <= x + w);
}

/** The item whose bar or following gap contains x (for the "you are looking at" announcement). */
export function itemAt(layout: Layout, x: number): LaidOut | null {
  for (const it of layout.items) if (x < it.x1 + layout.gap) return it;
  return layout.items[layout.items.length - 1] ?? null;
}

/** Nice tick spacing (in pixels) for the ruler: about every 120–240 px. */
export function tickStep(scale: number, targetPx = 180): { px: number; money: number } {
  const targetMoney = targetPx * scale;
  const pow = 10 ** Math.floor(Math.log10(targetMoney));
  const candidates = [1, 2, 5, 10].map((c) => c * pow);
  const money = candidates.reduce((best, c) => (Math.abs(c - targetMoney) < Math.abs(best - targetMoney) ? c : best), candidates[0]);
  return { px: money / scale, money };
}
