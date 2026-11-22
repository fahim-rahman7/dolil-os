import { Prisma } from '@prisma/client';
import { AppError } from './http.js';

export interface AreaConfig {
  base: 'sqft';
  factors: Record<string, number>; // square feet per 1 unit
  source: string;
  note: string;
}

/** Defaults are conventional values; the office must verify and may change them (BR-12). */
export const DEFAULT_AREA_CONFIG: AreaConfig = {
  base: 'sqft',
  factors: { decimal: 435.6, shotok: 435.6, katha: 720, bigha: 14400, acre: 43560, sqft: 1, sqm: 10.7639 },
  source: 'Default conversion table – verify before use',
  note: 'Configurable by the office owner. Not an official government table.',
};

export const readAreaConfig = (json: unknown): AreaConfig => {
  const c = json as Partial<AreaConfig> | null;
  if (!c || typeof c !== 'object' || !c.factors) return DEFAULT_AREA_CONFIG;
  return { ...DEFAULT_AREA_CONFIG, ...c, factors: c.factors as Record<string, number> };
};

export function assertUnit(cfg: AreaConfig, unit: string) {
  if (!(unit in cfg.factors)) {
    throw new AppError(400, `Unknown area unit "${unit}". Use one of: ${Object.keys(cfg.factors).join(', ')}.`, 'VALIDATION', {
      areaUnit: 'Select a configured area unit',
    });
  }
}

export interface Conversion {
  original: { value: string; unit: string };
  converted: { value: string; unit: string };
  factor: number; // sqft per original unit
  note: string;
}

/** Shows original and converted value plus the factor used (FR-CALC-02). */
export function convertArea(cfg: AreaConfig, area: Prisma.Decimal.Value, unit: string): Conversion {
  const factor = cfg.factors[unit];
  const value = new Prisma.Decimal(area);
  return {
    original: { value: value.toString(), unit },
    converted: { value: value.mul(factor).toDecimalPlaces(2).toString(), unit: 'sqft' },
    factor,
    note: `1 ${unit} = ${factor} sqft (${cfg.source})`,
  };
}

/** Bangla display names for area units (used in the deed document and narrative). */
const UNIT_BN: Record<string, string> = { decimal: 'শতক', shotok: 'শতক', katha: 'কাঠা', bigha: 'বিঘা', acre: 'একর', sqft: 'বর্গফুট', sqm: 'বর্গমিটার' };
export const unitBn = (u: string) => UNIT_BN[u] ?? u;
