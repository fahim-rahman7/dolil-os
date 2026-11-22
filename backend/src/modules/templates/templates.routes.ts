import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, userCan, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, parse, wrap } from '../../utils/http.js';
import { audit, reqText } from '../../utils/common.js';
import { DEED_TYPES, DEED_TYPE_NAMES } from '../../utils/deedTypes.js';
import { PLACEHOLDERS, PLACEHOLDER_RE } from '../../utils/draft.js';

const r = Router();

/** Controlled deed-type list with template status – used by the create-deed form (FR-TPL-01/02). */
r.get(
  '/types',
  wrap(async (req: AuthRequest, res) => {
    if (!(await userCan(req.user, 'deed:read'))) throw new AppError(403, 'You do not have permission to perform this action.');
    const rows = await prisma.deedTemplate.findMany({ where: { officeId: req.user.officeId }, orderBy: { version: 'desc' } });
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    return ok(
      res,
      DEED_TYPES.map((t) => {
        const approved = rows.find((x) => x.deedType === t.name && x.approvalStatus === 'APPROVED');
        const any = rows.find((x) => x.deedType === t.name);
        return {
          ...t,
          approved: !!approved,
          templateVersion: (approved ?? any)?.version ?? null,
          warning: approved
            ? null
            : office.allowGenericDraft
              ? `No approved template for ${t.name}. A clearly labelled draft will be generated; it cannot be marked READY until a template is approved.`
              : `No approved template for ${t.name} and office policy does not allow a generic draft.`,
        };
      }),
    );
  }),
);

r.get('/placeholders', wrap(async (_req, res) => ok(res, PLACEHOLDERS)));

r.get(
  '/',
  requirePerm('settings:read'),
  wrap(async (req: AuthRequest, res) =>
    ok(res, await prisma.deedTemplate.findMany({ where: { officeId: req.user.officeId }, orderBy: [{ deedType: 'asc' }, { version: 'desc' }] })),
  ),
);

const createSchema = z.object({
  deedType: z.enum(DEED_TYPE_NAMES as [string, ...string[]], { errorMap: () => ({ message: 'Select a configured deed type' }) }),
  name: reqText('Template name', 150, 2),
  body: reqText('Template body', 20000, 20),
});

/** Editing creates a new UNAPPROVED version; approved versions are never mutated (FR-TPL-04). */
r.post(
  '/',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const d = parse(createSchema, req.body);
    const unknown = [...d.body.matchAll(PLACEHOLDER_RE)].map((m) => m[1]).filter((k) => !PLACEHOLDERS.includes(k));
    if (unknown.length) {
      throw new AppError(400, `Unknown placeholder(s): ${[...new Set(unknown)].join(', ')}`, 'VALIDATION', { body: `Unknown placeholder: ${unknown[0]}` });
    }
    const last = await prisma.deedTemplate.findFirst({ where: { officeId: req.user.officeId, deedType: d.deedType }, orderBy: { version: 'desc' } });
    const t = await prisma.deedTemplate.create({
      data: { officeId: req.user.officeId, deedType: d.deedType, name: d.name, body: d.body, version: (last?.version ?? 0) + 1, createdById: req.user.id },
    });
    await audit(prisma, req, 'TEMPLATE_CREATED', 'DeedTemplate', t.id, { meta: { deedType: t.deedType, version: t.version } });
    return ok(res, t, 201);
  }),
);

r.post(
  '/:id/approve',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const t = await prisma.deedTemplate.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!t) throw new AppError(404, 'Template not found.');
    const updated = await prisma.deedTemplate.update({
      where: { id: t.id },
      data: { approvalStatus: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
    });
    await audit(prisma, req, 'TEMPLATE_APPROVED', 'DeedTemplate', t.id, { meta: { deedType: t.deedType, version: t.version } });
    return ok(res, updated);
  }),
);

r.post(
  '/:id/unapprove',
  requirePerm('settings:write'),
  wrap(async (req: AuthRequest, res) => {
    const t = await prisma.deedTemplate.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!t) throw new AppError(404, 'Template not found.');
    const updated = await prisma.deedTemplate.update({ where: { id: t.id }, data: { approvalStatus: 'UNAPPROVED', approvedById: null, approvedAt: null } });
    await audit(prisma, req, 'TEMPLATE_UNAPPROVED', 'DeedTemplate', t.id, { meta: { deedType: t.deedType, version: t.version } });
    return ok(res, updated);
  }),
);

export default r;
