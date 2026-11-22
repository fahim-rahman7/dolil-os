import bcrypt from 'bcryptjs';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { seedOffice } from '../prisma/seed.js';

export const PASSWORD = 'Passw0rd!x';
export const ROLES = ['OWNER', 'ADMIN', 'WRITER', 'ASSISTANT', 'ACCOUNTANT'] as const;
export type Role = (typeof ROLES)[number];

export interface Ctx {
  base: string;
  server: Server;
  officeId: string;
  tokens: Record<Role, string>;
  call: (method: string, path: string, body?: unknown, token?: string) => Promise<{ status: number; body: any; res: Response }>;
  close: () => Promise<void>;
}

export async function wipe() {
  // children first
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.updateMany({ data: { reversesId: null } });
  await prisma.payment.deleteMany();
  await prisma.deedRevision.deleteMany();
  await prisma.deedParty.deleteMany();
  await prisma.deedLand.deleteMany();
  await prisma.deed.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.land.deleteMany();
  await prisma.feeRate.deleteMany();
  await prisma.deedTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
}

export async function makeOfficeWithUsers(name: string, suffix: string) {
  const office = await seedOffice(prisma, name);
  const hash = await bcrypt.hash(PASSWORD, 4);
  for (const role of ROLES) {
    await prisma.user.create({
      data: { officeId: office.id, name: `${role} ${suffix}`, email: `${role.toLowerCase()}.${suffix}@test.local`, passwordHash: hash, role },
    });
  }
  return office;
}

export async function start(): Promise<Ctx> {
  await wipe();
  const office = await makeOfficeWithUsers('Test Office', 'a');
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}/api`;
  const call: Ctx['call'] = async (method, path, body, token) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const ct = res.headers.get('content-type') ?? '';
    const parsed = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body: parsed, res };
  };
  const tokens = {} as Record<Role, string>;
  for (const role of ROLES) {
    const r = await call('POST', '/auth/login', { email: `${role.toLowerCase()}.a@test.local`, password: PASSWORD });
    tokens[role] = r.body.data.token;
  }
  return { base, server, officeId: office.id, tokens, call, close: async () => { server.close(); await prisma.$disconnect(); } };
}
