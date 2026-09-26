import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deIncomeTax, deSoli, deTotal, usIncomeTax, usTotal, type DeParams, type UsParams } from '../../src/tax/calc';

const taxes = JSON.parse(readFileSync(new URL('../../data/taxes.json', import.meta.url), 'utf8'));
const pick = <T>(o: Record<string, { value: number }>): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.value])) as T;
const de = pick<DeParams>(taxes.parameters.DE);
const us = pick<UsParams>(taxes.parameters.US);

describe('German income tax 2026 (§ 32a EStG)', () => {
  it('is zero up to the basic allowance', () => {
    expect(deIncomeTax(12_348, de)).toBe(0);
    expect(deIncomeTax(12_349, de)).toBeGreaterThanOrEqual(0);
  });
  it('is continuous at the zone boundaries', () => {
    const at = (x: number) => deIncomeTax(x, de);
    expect(Math.abs(at(17_799) - at(17_800))).toBeLessThan(2);
    expect(Math.abs(at(69_878) - at(69_879))).toBeLessThan(2);
    expect(Math.abs(at(277_825) - at(277_826))).toBeLessThan(2);
  });
  it('has a 42 % marginal rate in zone 4 and 45 % in zone 5', () => {
    expect(deIncomeTax(101_000, de) - deIncomeTax(100_000, de)).toBe(420);
    expect(deIncomeTax(301_000, de) - deIncomeTax(300_000, de)).toBe(450);
  });
  it('charges no surcharge below the threshold and caps the phase-in', () => {
    expect(deSoli(20_000, de)).toBe(0);
    expect(deSoli(20_351, de)).toBeCloseTo(0.119, 3);
    expect(deSoli(100_000, de)).toBe(5_500);
  });
  it('median earner: plausible total burden', () => {
    const r = deTotal(54_066, de);
    expect(r.social).toBeGreaterThan(10_000);
    expect(r.social).toBeLessThan(12_500);
    expect(r.incomeTax).toBeGreaterThan(6_000);
    expect(r.incomeTax).toBeLessThan(9_000);
    expect(r.surcharge).toBe(0);
  });
});

describe('US federal income tax 2026 (single)', () => {
  it('applies the 10 % bracket first', () => {
    expect(usIncomeTax(10_000, us)).toBe(1_000);
  });
  it('applies 37 % above the top threshold', () => {
    expect(usIncomeTax(740_600, us) - usIncomeTax(640_600, us)).toBe(37_000);
  });
  it('caps Social Security at the wage base', () => {
    const a = usTotal(184_500, us).social;
    const b = usTotal(284_500, us).social;
    expect(b - a).toBeCloseTo(100_000 * 0.0145, 2);
  });
});
