import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { auth, requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { ok, parse, wrap } from '../../utils/http.js';
import { audit, emailField, optText, phoneField, reqText } from '../../utils/common.js';
import { readAreaConfig } from '../../utils/areas.js';
import { AppError } from '../../utils/http.js';

/** Public to every signed-in user: office identity + unit list (needed for print headers and forms). */
export const officeInfoRouter = Router();
officeInfoRouter.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const o = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    return ok(res, {
      id: o.id,
      name: o.name,
      phone: o.phone,
      email: o.email,
      address: o.address,
      print: { pageSize: o.printPageSize, marginMm: o.printMarginMm, font: o.printFont, header: o.printHeader, footer: o.printFooter },
      areaUnits: Object.keys(readAreaConfig(o.areaConversions).factors),
      allowGenericDraft: o.allowGenericDraft,
    });
  }),
);

const r = Router();

r.get(
  '/',
  requirePerm('settings:read'),
  wrap(async (req: AuthRequest, res) => {
    const o = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    return ok(res, { ...o, areaConversions: readAreaConfig(o.areaConversions) });
  }),
);

const profileSchema = z.object({
  name: reqText('Office name', 150, 2),
  phone: phoneField,
  email: emailField,
  address: optText(500),
});
r.put(
  '/profile',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(profileSchema, req.body);
    const o = await prisma.office.update({ where: { id: req.user.officeId }, data: d });
    await audit(prisma, req, 'OFFICE_PROFILE_UPDATED', 'Office', o.id);
    return ok(res, o);
  }),
);

const printSchema = z.object({
  printPageSize: z.enum(['A4', 'A5', 'Letter', 'Legal'], { errorMap: () => ({ message: 'Unsupported page size' }) }),
  printMarginMm: z.coerce.number().int().min(5, 'Margin must be 5–50 mm').max(50, 'Margin must be 5–50 mm'),
  printFont: z.enum(['Noto Sans Bengali', 'Nirmala UI', 'Kalpurush', 'SolaimanLipi', 'Arial'], { errorMap: () => ({ message: 'Unsupported font' }) }),
  printHeader: optText(500),
  printFooter: optText(500),
});
r.put(
  '/print',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(printSchema, req.body);
    const o = await prisma.office.update({ where: { id: req.user.officeId }, data: d });
    await audit(prisma, req, 'PRINT_SETTINGS_UPDATED', 'Office', o.id);
    return ok(res, o);
  }),
);

const policySchema = z.object({
  autoNumbering: z.boolean().optional(),
  numberPrefix: z.string().trim().regex(/^[A-Za-z0-9-]{1,10}$/, 'Prefix: 1–10 letters, digits or dashes').optional(),
  allowGenericDraft: z.boolean().optional(),
  adminCanManageSettings: z.boolean().optional(),
  adminCanManageUsers: z.boolean().optional(),
});
r.put(
  '/policy',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(policySchema, req.body);
    // Granting admin powers is an owner-only decision.
    if ((d.adminCanManageSettings !== undefined || d.adminCanManageUsers !== undefined) && req.user.role !== 'OWNER') {
      throw new AppError(403, 'Only the owner can grant administrator permissions.');
    }
    const o = await prisma.office.update({ where: { id: req.user.officeId }, data: d });
    await audit(prisma, req, 'OFFICE_POLICY_UPDATED', 'Office', o.id, { meta: d });
    return ok(res, o);
  }),
);

const areaSchema = z.object({
  factors: z
    .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_ -]{0,19}$/, 'Invalid unit name'), z.coerce.number().positive('Factor must be greater than zero'))
    .refine((f) => Object.keys(f).length > 0, 'At least one unit is required'),
  source: reqText('Source', 200),
});
r.put(
  '/area-conversions',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(areaSchema, req.body);
    const cfg = { base: 'sqft', factors: d.factors, source: d.source, note: `Updated by ${req.user.name}` };
    const o = await prisma.office.update({ where: { id: req.user.officeId }, data: { areaConversions: cfg } });
    await audit(prisma, req, 'AREA_CONVERSION_UPDATED', 'Office', o.id, { meta: { source: d.source } });
    return ok(res, readAreaConfig(o.areaConversions));
  }),
);

export default r;
export { auth };
