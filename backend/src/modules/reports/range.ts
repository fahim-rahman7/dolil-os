import { AppError } from '../../utils/http.js';

/** Inclusive date range interpreted in the office timezone (Asia/Dhaka, UTC+6). Rejects start > end (FR-REP-03). */
export function dateRange(from: unknown, to: unknown): { gte?: Date; lte?: Date } {
  const parse = (v: unknown, end: boolean, field: string) => {
    if (v === undefined || v === null || v === '') return undefined;
    const s = String(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00+06:00`).getTime())) {
      throw new AppError(400, 'Enter valid dates.', 'VALIDATION', { [field]: 'Enter a valid date' });
    }
    return new Date(`${s}T${end ? '23:59:59.999' : '00:00:00.000'}+06:00`);
  };
  const gte = parse(from, false, 'from');
  const lte = parse(to, true, 'to');
  if (gte && lte && gte > lte) {
    throw new AppError(400, 'Start date must be on or before the end date.', 'VALIDATION', { from: 'Start date is after end date' });
  }
  return { gte, lte };
}

export const rangeWhere = (field: string, r: { gte?: Date; lte?: Date }) =>
  r.gte || r.lte ? { [field]: { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) } } : {};
