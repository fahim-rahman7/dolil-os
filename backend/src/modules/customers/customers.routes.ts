import { Router } from 'express';
import { z } from 'zod';
import type { Customer, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, pageMeta, pageParams, parse, wrap } from '../../utils/http.js';
import { audit, canSeeFullNid, emailField, maskNid, nidField, optText, phoneField, reqText } from '../../utils/common.js';

const r = Router();

const schema = z.object({
  name: reqText('Full name', 120, 2),
  // Required for every party printed in a deed (the Bangladesh deed format needs them).
  phone: phoneField.refine((v) => !!v, 'Phone is required'),
  email: emailField,
  nid: nidField.refine((v) => !!v, 'NID is required'),
  fatherName: optText(120),
  motherName: optText(120),
  husbandName: optText(120),
  birthDate: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string({ required_error: 'Date of birth is required', invalid_type_error: 'Date of birth is required' })
      .regex(/^\d{4}-\d{2}-\d{2}/, 'Enter a valid date')
      .transform((v) => new Date(v.slice(0, 10)))
      .refine((d) => !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now(), 'Enter a valid date of birth'),
  ),
  religion: reqText('Religion', 50),
  profession: optText(100),
  nationality: reqText('Nationality', 50),
  permanentAddress: reqText('Permanent address', 500),
  address: optText(500),
  notes: optText(2000),
});

export const DUPLICATE_NID_MESSAGE = 'A customer with this NID already exists. Open the existing profile or verify the NID.';
export const IN_USE_MESSAGE = 'This record is used by an existing deed and cannot be deleted. Deactivate it instead.';

const present = (c: Customer, role: UserRole, full: boolean) => ({
  ...c,
  nid: full && canSeeFullNid(role) ? c.nid : maskNid(c.nid),
  nidMasked: !(full && canSeeFullNid(role)),
  missingIdentity: !c.nid,
});

async function assertUniqueNid(officeId: string, nid: string | null | undefined, selfId?: string) {
  if (!nid) return;
  const dup = await prisma.customer.findFirst({ where: { officeId, nid, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (dup) throw new AppError(409, DUPLICATE_NID_MESSAGE, 'DUPLICATE_NID', { nid: DUPLICATE_NID_MESSAGE });
}

r.get(
  '/',
  requirePerm('customer:read'),
  wrap(async (req: AuthRequest, res) => {
    const q = String(req.query.q ?? '').trim().normalize('NFC');
    const active = String(req.query.active ?? 'true');
    const p = pageParams(req.query);
    const where = {
      officeId: req.user.officeId,
      ...(active === 'all' ? {} : { active: active !== 'false' }),
      ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { nid: { contains: q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.customer.count({ where }),
    ]);
    return ok(res, rows.map((c) => present(c, req.user.role, false)), 200, pageMeta(p, total));
  }),
);

r.post(
  '/',
  requirePerm('customer:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(schema, req.body);
    await assertUniqueNid(req.user.officeId, d.nid);
    const c = await prisma.customer.create({ data: { ...d, officeId: req.user.officeId } });
    await audit(prisma, req, 'CUSTOMER_CREATED', 'Customer', c.id);
    return ok(res, present(c, req.user.role, true), 201);
  }),
);

r.get(
  '/:id',
  requirePerm('customer:read'),
  wrap(async (req: AuthRequest, res) => {
    const c = await prisma.customer.findFirst({
      where: { id: req.params.id, officeId: req.user.officeId },
      include: {
        deedParties: {
          include: { deed: { select: { id: true, title: true, deedType: true, status: true, deedNumber: true, createdAt: true } } },
          orderBy: { deed: { createdAt: 'desc' } },
        },
      },
    });
    if (!c) throw new AppError(404, 'Customer not found.');
    const { deedParties, ...rest } = c;
    return ok(res, { ...present(rest as Customer, req.user.role, true), deeds: deedParties.map((x) => ({ role: x.role, ...x.deed })) });
  }),
);

r.put(
  '/:id',
  requirePerm('customer:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(schema, req.body);
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Customer not found.');
    await assertUniqueNid(req.user.officeId, d.nid, existing.id);
    const c = await prisma.customer.update({ where: { id: existing.id }, data: d });
    await audit(prisma, req, 'CUSTOMER_UPDATED', 'Customer', c.id);
    return ok(res, present(c, req.user.role, true));
  }),
);

r.patch(
  '/:id/active',
  requirePerm('customer:delete'),
  wrap(async (req: AuthRequest, res) => {
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Customer not found.');
    const c = await prisma.customer.update({ where: { id: existing.id }, data: { active } });
    await audit(prisma, req, active ? 'CUSTOMER_REACTIVATED' : 'CUSTOMER_DEACTIVATED', 'Customer', c.id);
    return ok(res, present(c, req.user.role, true));
  }),
);

/** BR-13: records used by a deed are never removed; unreferenced records are soft-deleted. */
r.delete(
  '/:id',
  requirePerm('customer:delete'),
  wrap(async (req: AuthRequest, res) => {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Customer not found.');
    if (await prisma.deedParty.count({ where: { customerId: existing.id } })) throw new AppError(409, IN_USE_MESSAGE, 'IN_USE');
    await prisma.customer.update({ where: { id: existing.id }, data: { active: false } });
    await audit(prisma, req, 'CUSTOMER_DELETED', 'Customer', existing.id);
    return ok(res, { deleted: true, softDeleted: true });
  }),
);

export default r;
