import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, parse, wrap } from '../../utils/http.js';
import { audit, reqText } from '../../utils/common.js';

const r = Router();

r.get(
  '/',
  requirePerm('settings:read'),
  wrap(async (req: AuthRequest, res) =>
    ok(res, await prisma.feeRate.findMany({ where: { officeId: req.user.officeId }, orderBy: [{ label: 'asc' }, { effectiveFrom: 'desc' }] })),
  ),
);

const createSchema = z.object({
  label: reqText('Label', 120),
  kind: z.enum(['OFFICE', 'STATUTORY'], { errorMap: () => ({ message: 'Select a fee kind' }) }),
  basis: z.enum(['FIXED', 'PERCENT_OF_VALUE', 'PER_AREA_UNIT'], { errorMap: () => ({ message: 'Select a basis' }) }),
  rate: z.coerce.number({ invalid_type_error: 'Rate must be a number' }).min(0, 'Rate cannot be negative').max(999999999),
  effectiveFrom: z
    .string({ required_error: 'Effective date is required' })
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid effective date'),
  source: reqText('Source', 300, 3),
  verified: z.boolean().optional(),
});

/** Rates are effective-dated and append-only: a change is a new row with a later effective date. */
r.post(
  '/',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(createSchema, req.body);
    const rate = await prisma.feeRate.create({
      data: {
        officeId: req.user.officeId,
        label: d.label,
        kind: d.kind,
        basis: d.basis,
        rate: d.rate,
        effectiveFrom: new Date(d.effectiveFrom),
        source: d.source,
        verified: !!d.verified,
        approvedBy: d.verified ? req.user.name : null,
        lastVerifiedAt: d.verified ? new Date() : null,
        createdById: req.user.id,
      },
    });
    await audit(prisma, req, 'RATE_CREATED', 'FeeRate', rate.id, { meta: { label: d.label, kind: d.kind, rate: d.rate, verified: !!d.verified } });
    return ok(res, rate, 201);
  }),
);

r.patch(
  '/:id',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(z.object({ active: z.boolean().optional(), verified: z.boolean().optional() }), req.body);
    const existing = await prisma.feeRate.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Rate not found.');
    const rate = await prisma.feeRate.update({
      where: { id: existing.id },
      data: {
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.verified !== undefined
          ? { verified: d.verified, approvedBy: d.verified ? req.user.name : null, lastVerifiedAt: d.verified ? new Date() : null }
          : {}),
      },
    });
    await audit(prisma, req, 'RATE_UPDATED', 'FeeRate', rate.id, { meta: d });
    return ok(res, rate);
  }),
);

export default r;
