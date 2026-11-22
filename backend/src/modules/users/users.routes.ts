import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requirePerm, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, parse, wrap } from '../../utils/http.js';
import { audit, reqText, strongPassword } from '../../utils/common.js';

const r = Router();
r.use(requirePerm('user:manage'));

const roles = ['OWNER', 'ADMIN', 'WRITER', 'ASSISTANT', 'ACCOUNTANT'] as const;
const select = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

r.get(
  '/',
  wrap(async (req: AuthRequest, res) => ok(res, await prisma.user.findMany({ where: { officeId: req.user.officeId }, select, orderBy: { createdAt: 'asc' } }))),
);

const createSchema = z.object({
  name: reqText('Name', 100, 2),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: strongPassword,
  role: z.enum(roles, { errorMap: () => ({ message: 'Select a role' }) }),
});

/** Only an OWNER may create or modify OWNER-level users. */
function guardRole(actorRole: string, targetRole: string) {
  if (actorRole !== 'OWNER' && targetRole === 'OWNER') throw new AppError(403, 'Only an owner can manage owner accounts.');
}

r.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const d = parse(createSchema, req.body);
    guardRole(req.user.role, d.role);
    if (await prisma.user.findUnique({ where: { email: d.email } })) {
      throw new AppError(409, 'A user with this email already exists.', 'DUPLICATE', { email: 'Email already in use' });
    }
    const user = await prisma.user.create({
      data: { officeId: req.user.officeId, name: d.name, email: d.email, role: d.role, passwordHash: await bcrypt.hash(d.password, 12) },
      select,
    });
    await audit(prisma, req, 'USER_CREATED', 'User', user.id, { meta: { role: user.role } });
    return ok(res, user, 201);
  }),
);

const updateSchema = z.object({
  name: reqText('Name', 100, 2).optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
  password: strongPassword.optional(),
});

r.patch(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const d = parse(updateSchema, req.body);
    const target = await prisma.user.findFirst({ where: { id: req.params.id, officeId: req.user.officeId } });
    if (!target) throw new AppError(404, 'User not found.');
    guardRole(req.user.role, target.role);
    if (d.role) guardRole(req.user.role, d.role);
    if (target.id === req.user.id && (d.role && d.role !== target.role || d.active === false)) {
      throw new AppError(409, 'You cannot change your own role or deactivate your own account.');
    }
    const data: Record<string, unknown> = {};
    if (d.name) data.name = d.name;
    if (d.role) data.role = d.role;
    if (d.active !== undefined) data.active = d.active;
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 12);
    const user = await prisma.user.update({ where: { id: target.id }, data, select });
    await audit(prisma, req, 'USER_UPDATED', 'User', user.id, {
      meta: { roleFrom: target.role, roleTo: user.role, active: user.active, passwordReset: !!d.password },
    });
    return ok(res, user);
  }),
);

export default r;
