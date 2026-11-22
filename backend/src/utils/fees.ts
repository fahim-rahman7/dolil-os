import { Prisma, type FeeBasis, type FeeKind } from '@prisma/client';

export const ESTIMATE_LABEL = 'ESTIMATE – VERIFY OFFICIAL RATE';

export interface RateRow {
  id: string;
  label: string;
  kind: FeeKind;
  basis: FeeBasis;
  rate: Prisma.Decimal | string | number;
  effectiveFrom: Date;
  source: string;
  verified: boolean;
  active: boolean;
}

export interface FeeLine {
  key: string;
  label: string;
  kind: FeeKind;
  basis: FeeBasis;
  rate: string;
  basisText: string;
  amount: string; // computed amount
  effectiveFrom: string;
  source: string;
  estimateLabel: string | null;
  override?: { amount: string; by: string; byId: string; reason: string; at: string };
  finalAmount: string; // override if present else amount
}

export interface Override {
  key: string;
  amount: number;
  reason: string;
}

export const feeKey = (r: { label: string; kind: FeeKind }) => `${r.kind}:${r.label.trim().toLowerCase()}`;

/** Latest effective, active rate per (kind,label) on/before the given date. */
export function pickEffectiveRates(rates: RateRow[], on: Date): RateRow[] {
  const best = new Map<string, RateRow>();
  for (const r of rates) {
    if (!r.active || r.effectiveFrom > on) continue;
    const k = feeKey(r);
    const cur = best.get(k);
    if (!cur || r.effectiveFrom > cur.effectiveFrom) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function computeFees(input: {
  landValue: Prisma.Decimal.Value;
  area: Prisma.Decimal.Value;
  areaUnit: string;
  rates: RateRow[];
  on: Date;
  overrides?: Override[];
  overriddenBy?: { id: string; name: string };
  previous?: FeeLine[];
}): { lines: FeeLine[]; total: string } {
  const value = new Prisma.Decimal(input.landValue);
  const area = new Prisma.Decimal(input.area);
  const now = new Date().toISOString();
  const lines: FeeLine[] = pickEffectiveRates(input.rates, input.on).map((r) => {
    const rate = new Prisma.Decimal(r.rate);
    let amount: Prisma.Decimal;
    let basisText: string;
    if (r.basis === 'FIXED') {
      amount = rate;
      basisText = 'Fixed amount';
    } else if (r.basis === 'PERCENT_OF_VALUE') {
      amount = value.mul(rate).div(100);
      basisText = `${rate.toString()}% of land value ${value.toFixed(2)}`;
    } else {
      amount = area.mul(rate);
      basisText = `${rate.toString()} × area ${area.toString()} ${input.areaUnit}`;
    }
    amount = amount.toDecimalPlaces(2);
    const key = feeKey(r);
    const line: FeeLine = {
      key,
      label: r.label,
      kind: r.kind,
      basis: r.basis,
      rate: rate.toString(),
      basisText,
      amount: amount.toFixed(2),
      effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
      source: r.source,
      estimateLabel: r.verified ? null : ESTIMATE_LABEL,
      finalAmount: amount.toFixed(2),
    };
    const ov = input.overrides?.find((o) => o.key === key);
    if (ov) {
      line.override = {
        amount: new Prisma.Decimal(ov.amount).toFixed(2),
        by: input.overriddenBy?.name ?? '',
        byId: input.overriddenBy?.id ?? '',
        reason: ov.reason,
        at: now,
      };
      line.finalAmount = line.override.amount;
      line.estimateLabel = null; // manually verified amount replaces the estimate
    } else {
      const prev = input.previous?.find((p) => p.key === key)?.override;
      if (prev) {
        line.override = prev;
        line.finalAmount = prev.amount;
        line.estimateLabel = null;
      }
    }
    return line;
  });
  const total = lines.reduce((s, l) => s.add(l.finalAmount), new Prisma.Decimal(0));
  return { lines, total: total.toFixed(2) };
}
