import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { ok, parse, wrap } from '../../utils/http.js';
import { readAreaConfig } from '../../utils/areas.js';
import { calcInputSchema, calculate } from './calc.service.js';

const r = Router();

r.get(
  '/units',
  wrap(async (req: AuthRequest, res) => {
    const o = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    return ok(res, readAreaConfig(o.areaConversions));
  }),
);

const previewSchema = z.object({ ...calcInputSchema, date: z.string().optional().nullable() });

r.post(
  '/preview',
  requirePerm('deed:read'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(previewSchema, req.body);
    const when = d.date ? new Date(d.date) : new Date();
    return ok(
      res,
      await calculate(prisma, {
        officeId: req.user.officeId,
        valuationBasis: d.valuationBasis,
        perUnitRate: d.perUnitRate,
        landValue: d.landValue,
        totalArea: d.totalArea,
        areaUnit: d.areaUnit,
        date: Number.isNaN(when.getTime()) ? new Date() : when,
        overrides: d.feeOverrides,
        overriddenBy: { id: req.user.id, name: req.user.name },
      }),
    );
  }),
);

export default r;
