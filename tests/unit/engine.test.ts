import { describe, expect, it } from 'vitest';
import { buildLayout, clampX, itemAt, moneyAt, tickStep, visible, xAtMoney } from '../../src/scroll/engine';

const segs = [
  { id: 'a', value: 50_000, kind: 'reference' as const },
  { id: 'b', value: 1_000_000, kind: 'million' as const },
  { id: 'c', value: 900_000_000_000, kind: 'world' as const },
];

describe('scroll layout', () => {
  it('lays out bars at value/scale pixels with gaps', () => {
    const l = buildLayout(segs, 1000, 10);
    expect(l.items[0].x0).toBe(0);
    expect(l.items[0].x1).toBe(50);
    expect(l.items[1].x0).toBe(60);
    expect(l.items[1].x1).toBe(1060);
    expect(l.items[2].x0).toBe(1070);
    expect(l.totalWidth).toBe(1070 + 900_000_000);
    expect(l.totalMoney).toBe(900_001_050_000);
  });

  it('never produces DOM-sized widths: total width is a plain number, bars are drawn only when visible', () => {
    const l = buildLayout(segs, 1000, 10);
    expect(Number.isFinite(l.totalWidth)).toBe(true);
    expect(visible(l, 0, 1200).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(visible(l, 500_000_000, 1200).map((i) => i.id)).toEqual(['c']);
  });

  it('money scrolled counts full bars plus the partial one, not gap pixels', () => {
    const l = buildLayout(segs, 1000, 10);
    expect(moneyAt(l, 0)).toBe(0);
    expect(moneyAt(l, 25)).toBe(25_000);
    expect(moneyAt(l, 55)).toBe(50_000); // inside the gap
    expect(moneyAt(l, 1060)).toBe(1_050_000);
    expect(moneyAt(l, 1070 + 1000)).toBe(1_050_000 + 1_000_000);
  });

  it('xAtMoney is the inverse of moneyAt on bars', () => {
    const l = buildLayout(segs, 1000, 10);
    for (const m of [10_000, 50_000, 1_000_000, 500_000_000_000]) {
      const x = xAtMoney(l, m)!;
      expect(moneyAt(l, x)).toBeCloseTo(m, 3);
    }
    expect(xAtMoney(l, 1e15)).toBeNull();
  });

  it('clamps positions and finds the current item', () => {
    const l = buildLayout(segs, 1000, 10);
    expect(clampX(l, -100, 800)).toBe(0);
    expect(clampX(l, 1e12, 800)).toBe(l.totalWidth - 400);
    expect(itemAt(l, 0)!.id).toBe('a');
    expect(itemAt(l, 55)!.id).toBe('a');
    expect(itemAt(l, 2000)!.id).toBe('c');
  });

  it('picks nice ruler ticks', () => {
    expect(tickStep(1000).money).toBe(200_000);
    expect(tickStep(100).money).toBe(20_000);
    expect(tickStep(10000).money).toBe(2_000_000);
  });
});
