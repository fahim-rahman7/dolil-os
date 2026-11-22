import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, pageMeta, pageParams, parse, wrap } from '../../utils/http.js';
import { audit, optText, reqText } from '../../utils/common.js';
import { assertUnit, convertArea, readAreaConfig } from '../../utils/areas.js';
import { IN_USE_MESSAGE } from '../customers/customers.routes.js';

const r = Router();

const schema = z.object({
  district: reqText('District', 100, 2),
  upazila: reqText('Upazila / Thana', 100, 2),
  mouza: reqText('Mouza', 100),
  jlNumber: optText(50),
  union: optText(100),
  landOffice: reqText('Land office', 150),
  holdingNo: reqText('Holding no.', 50),
  khatianNumber: reqText('Khatian number', 50),
  khatianType: optText(50),
  dagNumber: reqText('Dag number', 50), // trimmed only: leading zeros / notation are preserved
  area: z.coerce
    .number({ invalid_type_error: 'Area must be a number' })
    .gt(0, 'Area must be greater than zero')
    .max(99999999, 'Area is too large')
    .refine((n) => Math.round(n * 10000) / 10000 === n, 'Area can have at most 4 decimal places'),
  areaUnit: z.string().trim().min(1, 'Area unit is required'),
  classification: optText(100),
  ownershipDetails: optText(2000),
  boundaryNorth: optText(200),
  boundarySouth: optText(200),
  boundaryEast: optText(200),
  boundaryWest: optText(200),
});

const IDENTITY_FIELDS = ['district', 'upazila', 'mouza', 'dagNumber', 'khatianNumber', 'jlNumber', 'area', 'areaUnit'] as const;

r.get(
  '/',
  requirePerm('land:read'),
  wrap(async (req: AuthRequest, res) => {
    const q = String(req.query.q ?? '').trim().normalize('NFC');
    const active = String(req.query.active ?? 'true');
    const p = pageParams(req.query);
    const where = {
      officeId: req.user.officeId,
      ...(active === 'all' ? {} : { active: active !== 'false' }),
      ...(q
        ? { OR: [{ district: { contains: q } }, { upazila: { contains: q } }, { mouza: { contains: q } }, { khatianNumber: { contains: q } }, { dagNumber: { contains: q } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.land.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.land.count({ where }),
    ]);
    return ok(res, rows, 200, pageMeta(p, total));
  }),
);

r.post(
  '/',
  requirePerm('land:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(schema, req.body);
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    assertUnit(readAreaConfig(office.areaConversions), d.areaUnit);
    const land = await prisma.land.create({ data: { ...d, officeId: req.user.officeId } });
    await audit(prisma, req, 'LAND_CREATED', 'Land', land.id);
    return ok(res, land, 201);
  }),
);

r.get(
  '/:id',
  requirePerm('land:read'),
  wrap(async (req: AuthRequest, res) => {
    const land = await prisma.land.findFirst({
      where: { id: req.params.id, officeId: req.user.officeId },
      include: {
        deedLands: {
          include: { deed: { select: { id: true, title: true, deedType: true, status: true, deedNumber: true, createdAt: true } } },
          orderBy: { deed: { createdAt: 'desc' } },
        },
      },
    });
    if (!land) throw new AppError(404, 'Land record not found.');
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    const { deedLands, ...rest } = land;
    const cfg = readAreaConfig(office.areaConversions);
    return ok(res, {
      ...rest,
      deeds: deedLands.map((x) => x.deed),
      conversion: cfg.factors[land.areaUnit] ? convertArea(cfg, land.area, land.areaUnit) : null,
      // BR-03: a stored land record does not prove ownership.
      notice: 'This record is an office note. It does not prove ownership or title; verify against official records.',
    });
  }),
);

r.put(
  '/:id',
  requirePerm('land:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(schema, req.body);
    const existing = await prisma.land.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Land record not found.');
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    assertUnit(readAreaConfig(office.areaConversions), d.areaUnit);
    // Restricted edit when linked to a finalized deed: identifying fields are locked.
    const finalized = await prisma.deedLand.count({ where: { landId: existing.id, deed: { status: { in: ['READY', 'PRINTED', 'DELIVERED'] } } } });
    if (finalized) {
      const changed = IDENTITY_FIELDS.filter((f) => String(d[f] ?? '') !== String((existing as any)[f] ?? ''));
      if (changed.length) {
        throw new AppError(
          409,
          `This land record is linked to a finalized deed. Identifying fields cannot be changed (${changed.join(', ')}). Move the deed back to review first.`,
          'RESTRICTED_EDIT',
        );
      }
    }
    const land = await prisma.land.update({ where: { id: existing.id }, data: d });
    await audit(prisma, req, 'LAND_UPDATED', 'Land', land.id);
    return ok(res, land);
  }),
);

r.patch(
  '/:id/active',
  requirePerm('land:delete'),
  wrap(async (req: AuthRequest, res) => {
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const existing = await prisma.land.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Land record not found.');
    const land = await prisma.land.update({ where: { id: existing.id }, data: { active } });
    await audit(prisma, req, active ? 'LAND_REACTIVATED' : 'LAND_DEACTIVATED', 'Land', land.id);
    return ok(res, land);
  }),
);

r.delete(
  '/:id',
  requirePerm('land:delete'),
  wrap(async (req: AuthRequest, res) => {
    const existing = await prisma.land.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!existing) throw new AppError(404, 'Land record not found.');
    if (await prisma.deedLand.count({ where: { landId: existing.id } })) throw new AppError(409, IN_USE_MESSAGE, 'IN_USE');
    await prisma.land.update({ where: { id: existing.id }, data: { active: false } });
    await audit(prisma, req, 'LAND_DELETED', 'Land', existing.id);
    return ok(res, { deleted: true, softDeleted: true });
  }),
);

export default r;
