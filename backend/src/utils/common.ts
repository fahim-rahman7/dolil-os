import { Prisma, type PrismaClient } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { z } from 'zod';

export type Db = PrismaClient | Prisma.TransactionClient;

// ---------- audit ----------
export async function audit(
  db: Db,
  req: { id?: string; user?: { id: string; officeId: string } },
  action: string,
  entity: string,
  entityId?: string | null,
  extra: { reason?: string | null; meta?: Record<string, unknown> } = {},
  override?: { officeId?: string | null; userId?: string | null },
) {
  await db.auditLog.create({
    data: {
      officeId: override?.officeId ?? req.user?.officeId ?? null,
      userId: override?.userId ?? req.user?.id ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      reason: extra.reason ?? null,
      meta: (extra.meta as Prisma.InputJsonValue) ?? undefined,
      correlationId: req.id ?? null,
    },
  });
}

// ---------- privacy (BR-16) ----------
export const maskNid = (nid?: string | null) =>
  nid ? `${'*'.repeat(Math.max(0, nid.length - 3))}${nid.slice(-3)}` : nid ?? null;

export const canSeeFullNid = (role: UserRole) => role !== 'ACCOUNTANT';

// ---------- CSV (safe encoding, formula-injection guard) ----------
export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export const csvLine = (cells: unknown[]) => cells.map(csvCell).join(',');
export const csvDoc = (lines: string[]) => `﻿${lines.join('\r\n')}\r\n`;

// ---------- validators ----------
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?88)?(01[3-9]\d{8})$/.exec(s);
  if (m) return m[1];
  if (/^\+?\d{7,15}$/.test(s)) return s;
  return null;
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Bangla can be typed with a precomposed য়/ড়/ঢ় or the two-character form: store one canonical (NFC) form so equality and search work. */
export const nfc = (s: string) => s.normalize('NFC');

export const optText = (max = 500) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `Must be ${max} characters or fewer`).transform(nfc).nullable().optional());

export const reqText = (label: string, max = 200, min = 1) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform(nfc);

export const phoneField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number (e.g. 01712345678)' });
        return z.NEVER;
      }
      return n;
    })
    .nullable()
    .optional(),
);

export const emailField = z.preprocess(
  blankToNull,
  z.string().trim().max(150).email('Enter a valid email address').nullable().optional(),
);

/** Bangladesh NID: 10, 13 or 17 digits (policy configurable here). */
export const nidField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .regex(/^(\d{10}|\d{13}|\d{17})$/, 'NID must be 10, 13 or 17 digits')
    .nullable()
    .optional(),
);

export const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .finite()
    .min(0, `${label} cannot be negative`)
    .max(99999999999999, `${label} is too large`)
    .refine((n) => Math.round(n * 100) / 100 === n, `${label} can have at most 2 decimal places`);

export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Password must include upper-case, lower-case and a number');

export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const num = (v: unknown) => (v == null ? 0 : Number(v));

export const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' }) : '';

export const escapeLike = (s: string) => s.trim();
