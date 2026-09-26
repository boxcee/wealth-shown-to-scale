/**
 * Plausibility gate: a fetched value that deviates from the last known good
 * value by more than `threshold` (fraction, e.g. 0.4 = 40 %) is NOT written.
 * Instead it lands in the review queue for a human.
 */
export interface DeltaCheck {
  ok: boolean;
  deltaFraction: number | null;
  reason?: string;
}

export function checkDelta(oldValue: number | null | undefined, newValue: number, threshold: number): DeltaCheck {
  if (!Number.isFinite(newValue)) return { ok: false, deltaFraction: null, reason: 'new value is not a finite number' };
  if (oldValue === null || oldValue === undefined) return { ok: true, deltaFraction: null, reason: 'no previous value' };
  if (oldValue === 0) return { ok: newValue === 0, deltaFraction: null, reason: 'previous value was zero' };
  const delta = Math.abs(newValue - oldValue) / Math.abs(oldValue);
  if (delta > threshold) {
    return { ok: false, deltaFraction: delta, reason: `deviates by ${(delta * 100).toFixed(1)} % (threshold ${(threshold * 100).toFixed(0)} %)` };
  }
  return { ok: true, deltaFraction: delta };
}

export interface ReviewItem {
  file: string;
  key: string;
  label: string;
  oldValue: number | null;
  newValue: number;
  currency: string | null;
  reason: string;
  source: string;
  source_url: string;
}
