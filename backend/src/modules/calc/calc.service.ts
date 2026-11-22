import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { assertUnit, convertArea, readAreaConfig } from '../../utils/areas.js';
import { computeFees, type FeeLine, type Override } from '../../utils/fees.js';
import { AppError } from '../../utils/http.js';
import { money, type Db } from '../../utils/common.js';

export const calcInputSchema = {
  valuationBasis: z.enum(['TOTAL', 'PER_UNIT']).default('TOTAL'),
  perUnitRate: money('Per-unit rate').optional().nullable(),
  landValue: money('Land value').default(0),
  // Area is stored as DECIMAL(12,4): up to 4 decimal places (e.g. 0.1350 acre).
  totalArea: z.coerce
    .number({ invalid_type_error: 'Area must be a number' })
    .finite()
    .min(0, 'Area cannot be negative')
    .max(99999999, 'Area is too large')
    .refine((n) => Math.round(n * 10000) / 10000 === n, 'Area can have at most 4 decimal places')
    .default(0),
  areaUnit: z.string().trim().min(1, 'Area unit is required').default('decimal'),
  feeOverrides: z
    .array(
      z.object({
        key: z.string().min(1),
        amount: money('Override amount'),
        reason: z.string().trim().min(3, 'A reason is required for a manual override').max(500),
      }),
    )
    .optional(),
};

export interface CalcArgs {
  officeId: string;
  valuationBasis: 'TOTAL' | 'PER_UNIT';
  perUnitRate?: number | null;
  landValue: number;
  totalArea: number;
  areaUnit: string;
  date: Date;
  overrides?: Override[];
  overriddenBy?: { id: string; name: string };
  previous?: FeeLine[];
}

/** FR-CALC-01..06 */
export async function calculate(db: Db, a: CalcArgs) {
  const office = await db.office.findUniqueOrThrow({ where: { id: a.officeId } });
  const cfg = readAreaConfig(office.areaConversions);
  assertUnit(cfg, a.areaUnit);
  let landValue = new Prisma.Decimal(a.landValue);
  let valueBasis = 'Total land value entered by the user';
  if (a.valuationBasis === 'PER_UNIT') {
    if (a.perUnitRate == null) {
      throw new AppError(400, 'Enter the per-unit rate for per-unit valuation.', 'VALIDATION', { perUnitRate: 'Per-unit rate is required' });
    }
    landValue = new Prisma.Decimal(a.perUnitRate).mul(a.totalArea).toDecimalPlaces(2);
    valueBasis = `${a.perUnitRate} per ${a.areaUnit} × ${a.totalArea} ${a.areaUnit}`;
  }
  const rates = await db.feeRate.findMany({ where: { officeId: a.officeId } });
  const fees = computeFees({
    landValue,
    area: a.totalArea,
    areaUnit: a.areaUnit,
    rates,
    on: a.date,
    overrides: a.overrides,
    overriddenBy: a.overriddenBy,
    previous: a.previous,
  });
  for (const o of a.overrides ?? []) {
    if (!fees.lines.some((l) => l.key === o.key)) {
      throw new AppError(400, `No fee line "${o.key}" exists to override.`, 'VALIDATION', { feeOverrides: 'Unknown fee line' });
    }
  }
  return {
    landValue: landValue.toFixed(2),
    valueBasis,
    conversion: convertArea(cfg, a.totalArea, a.areaUnit),
    lines: fees.lines,
    totalFees: fees.total,
    disclaimer: 'Fee lines are configured estimates, not official government fee advice. Verify current official rates before relying on them.',
  };
}
