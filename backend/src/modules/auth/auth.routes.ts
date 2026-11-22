import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { auth, type AuthRequest } from '../../middleware/auth.js';
import { AppError, ok, parse, wrap } from '../../utils/http.js';
import { audit, strongPassword } from '../../utils/common.js';
import { can } from '../../utils/permissions.js';

export const publicAuthRouter = Router();
export const privateAuthRouter = Router();

const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
});

publicAuthRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = !!user && user.active && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) {
      // Never log the password.
      await audit(prisma, req, 'LOGIN_FAILED', 'User', user?.id ?? null, { meta: { email } }, { officeId: user?.officeId ?? null, userId: null });
      throw new AppError(401, 'Invalid email or password.');
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '12h' });
    await audit(prisma, req, 'LOGIN_SUCCESS', 'User', user.id, {}, { officeId: user.officeId, userId: user.id });
    return ok(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);

privateAuthRouter.get(
  '/me',
  auth,
  wrap(async (req: AuthRequest, res) => {
    const office = await prisma.office.findUniqueOrThrow({ where: { id: req.user.officeId } });
    const flags = { adminCanManageSettings: office.adminCanManageSettings, adminCanManageUsers: office.adminCanManageUsers };
    return ok(res, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      office: { id: office.id, name: office.name },
      permissions: {
        settingsWrite: can(req.user.role, 'settings:write', flags),
        settingsRead: can(req.user.role, 'settings:read', flags),
        userManage: can(req.user.role, 'user:manage', flags),
      },
    });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
  newPassword: strongPassword,
});

privateAuthRouter.post(
  '/change-password',
  auth,
  wrap(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'Current password is incorrect.', 'VALIDATION', { currentPassword: 'Current password is incorrect' });
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, 'New password must be different from the current password.', 'VALIDATION', { newPassword: 'Choose a different password' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    await audit(prisma, req, 'PASSWORD_CHANGED', 'User', user.id);
    return ok(res, { changed: true });
  }),
);

privateAuthRouter.post(
  '/logout',
  auth,
  wrap(async (req: AuthRequest, res) => {
    await audit(prisma, req, 'LOGOUT', 'User', req.user.id);
    return ok(res, { signedOut: true });
  }),
);
