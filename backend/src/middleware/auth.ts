import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError, wrap } from '../utils/http.js';
import { can, type Perm } from '../utils/permissions.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  officeId: string;
}
export type AuthRequest = Omit<Request, 'params'> & { user: AuthUser; id?: string; params: Record<string, string> };

/** Verifies the bearer token, then re-reads the user so role changes/deactivation apply immediately. */
export const auth = wrap(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required');
  let payload: { id: string };
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: string };
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.active) throw new AppError(401, 'Invalid or expired token');
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, officeId: user.officeId };
  next();
});

export const requirePerm = (...perms: Perm[]) =>
  wrap(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const flags = req.user.role === 'ADMIN'
      ? await prisma.office.findUnique({
          where: { id: req.user.officeId },
          select: { adminCanManageSettings: true, adminCanManageUsers: true },
        })
      : undefined;
    if (!perms.some((p) => can(req.user.role, p, flags ?? undefined))) {
      throw new AppError(403, 'You do not have permission to perform this action.');
    }
    next();
  });

export async function userCan(user: AuthUser, perm: Perm): Promise<boolean> {
  const flags = user.role === 'ADMIN'
    ? await prisma.office.findUnique({
        where: { id: user.officeId },
        select: { adminCanManageSettings: true, adminCanManageUsers: true },
      })
    : undefined;
  return can(user.role, perm, flags ?? undefined);
}
