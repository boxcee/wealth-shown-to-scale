/**
 * Income tax and social contribution calculators for the comparison tool.
 * Parameters come from data/taxes.json (each with a source), never from constants here.
 */
export interface DeParams {
  basic_allowance: number;
  zone2_upper: number;
  zone2_a: number;
  zone2_b: number;
  zone3_upper: number;
  zone3_a: number;
  zone3_b: number;
  zone3_c: number;
  zone4_upper: number;
  zone4_c: number;
  zone5_c: number;
  soli_rate: number;
  soli_threshold: number;
  soli_phase_in_rate: number;
  pension_rate_employee: number;
  unemployment_rate_employee: number;
  health_rate_employee: number;
  care_rate_employee: number;
  ceiling_pension_annual: number;
  ceiling_health_annual: number;
}

export interface UsParams {
  standard_deduction_single: number;
  bracket1_upper: number;
  bracket2_upper: number;
  bracket3_upper: number;
  bracket4_upper: number;
  bracket5_upper: number;
  bracket6_upper: number;
  social_security_rate_employee: number;
  medicare_rate_employee: number;
  social_security_wage_base: number;
}

export interface TaxResult {
  incomeTax: number;
  surcharge: number;
  social: number;
  taxable: number;
}

/** Employee lump-sum deduction for work-related expenses (§ 9a EStG), 2023 onwards. */
export const DE_WERBUNGSKOSTEN_PAUSCHALE = 1230;

/** German income tax per § 32a Abs. 1 EStG (single, 2026 formula parameters). */
export function deIncomeTax(taxable: number, p: DeParams): number {
  const x = Math.floor(Math.max(0, taxable));
  if (x <= p.basic_allowance) return 0;
  let tax: number;
  if (x <= p.zone2_upper) {
    const y = (x - p.basic_allowance) / 10000;
    tax = (p.zone2_a * y + p.zone2_b) * y;
  } else if (x <= p.zone3_upper) {
    const z = (x - p.zone2_upper) / 10000;
    tax = (p.zone3_a * z + p.zone3_b) * z + p.zone3_c;
  } else if (x <= p.zone4_upper) {
    tax = 0.42 * x - p.zone4_c;
  } else {
    tax = 0.45 * x - p.zone5_c;
  }
  return Math.floor(tax);
}

/** Solidarity surcharge with exemption threshold and sliding zone (§§ 3, 4 SolzG). */
export function deSoli(incomeTax: number, p: DeParams): number {
  if (incomeTax <= p.soli_threshold) return 0;
  const full = incomeTax * (p.soli_rate / 100);
  const capped = (incomeTax - p.soli_threshold) * (p.soli_phase_in_rate / 100);
  return Math.min(full, capped);
}

export function deSocial(gross: number, p: DeParams): number {
  const pensionBase = Math.min(gross, p.ceiling_pension_annual);
  const healthBase = Math.min(gross, p.ceiling_health_annual);
  return (
    pensionBase * ((p.pension_rate_employee + p.unemployment_rate_employee) / 100) +
    healthBase * ((p.health_rate_employee + p.care_rate_employee) / 100)
  );
}

/**
 * Simplified German wage-earner calculation: social contributions and the employee lump sum
 * are deducted before the tariff is applied (in reality only part of the health contribution
 * and the full pension contribution are deductible; the difference is small at median incomes).
 */
export function deTotal(gross: number, p: DeParams): TaxResult {
  const social = deSocial(gross, p);
  const taxable = Math.max(0, gross - social - DE_WERBUNGSKOSTEN_PAUSCHALE);
  const incomeTax = deIncomeTax(taxable, p);
  return { incomeTax, surcharge: deSoli(incomeTax, p), social, taxable };
}

/** US federal income tax, single filer, standard deduction. */
export function usIncomeTax(taxable: number, p: UsParams): number {
  const brackets: [number, number][] = [
    [p.bracket1_upper, 0.1],
    [p.bracket2_upper, 0.12],
    [p.bracket3_upper, 0.22],
    [p.bracket4_upper, 0.24],
    [p.bracket5_upper, 0.32],
    [p.bracket6_upper, 0.35],
    [Infinity, 0.37],
  ];
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax);
}

export function usSocial(gross: number, p: UsParams): number {
  return Math.min(gross, p.social_security_wage_base) * (p.social_security_rate_employee / 100) + gross * (p.medicare_rate_employee / 100);
}

export function usTotal(gross: number, p: UsParams): TaxResult {
  const taxable = Math.max(0, gross - p.standard_deduction_single);
  return { incomeTax: usIncomeTax(taxable, p), surcharge: 0, social: usSocial(gross, p), taxable };
}
