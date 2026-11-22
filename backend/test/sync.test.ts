import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { can as backendCan, ROLE_PERMS, type Perm } from '../src/utils/permissions.js';
import { STATUSES } from '../src/utils/transitions.js';
import { PARTY_ROLES as BACKEND_ROLES } from '../src/utils/deedTypes.js';
// The frontend permission mirror is plain TypeScript without imports, so the backend suite can load it directly.
import { can as frontendCan, STATUS_LABEL, PARTY_ROLES as FRONTEND_ROLES, ROLE_LABEL } from '../../frontend/src/lib/perms.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROLES = ['OWNER', 'ADMIN', 'WRITER', 'ASSISTANT', 'ACCOUNTANT'] as const;

test('SYNC: frontend permission mirror equals the backend matrix for every role and shared permission', () => {
  const frontendPerms = new Set<string>();
  const src = readFileSync(path.join(here, '../../frontend/src/lib/perms.ts'), 'utf8');
  for (const m of src.matchAll(/'([a-z]+:[a-z]+)'/g)) frontendPerms.add(m[1]);
  assert.ok(frontendPerms.size >= 15, 'found the frontend permission names');
  const allBackend = new Set<string>(Object.values(ROLE_PERMS).flat());
  for (const p of frontendPerms) assert.ok(allBackend.has(p), `frontend uses unknown permission ${p}`);
  const diffs: string[] = [];
  for (const role of ROLES) {
    for (const p of frontendPerms) {
      // ADMIN's settings/user powers are granted dynamically by the owner; the UI reads those from /auth/me.
      if (role === 'ADMIN' && (p === 'settings:write' || p === 'user:manage')) continue;
      const f = frontendCan(role, p as any);
      const b = backendCan(role, p as Perm);
      if (f !== b) diffs.push(`${role} ${p}: frontend=${f} backend=${b}`);
    }
  }
  assert.deepEqual(diffs, [], 'permission drift between UI and API');
});

test('SYNC: status labels and party roles match the backend enums', () => {
  assert.deepEqual(Object.keys(STATUS_LABEL).sort(), [...STATUSES].sort());
  assert.deepEqual([...FRONTEND_ROLES].sort(), [...BACKEND_ROLES].sort());
  assert.deepEqual(Object.keys(ROLE_LABEL).sort(), [...BACKEND_ROLES].sort());
});

test('SYNC: every API path the frontend calls exists on the backend', async () => {
  // Routes registered by the Express app (method + normalised path) vs paths found in the frontend sources.
  const { default: app } = await import('../src/app.js');
  const routes = new Set<string>();
  const mount = (re: RegExp): string => {
    const m = re.source.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/);
    return m ? '/' + m[1].replace(/\\\//g, '/') : '';
  };
  const walk = (stack: any[], prefix: string) => {
    for (const l of stack) {
      if (l.route) routes.add(`${prefix}${l.route.path === '/' ? '' : l.route.path}`.replace(/:[A-Za-z]+/g, ':p'));
      else if (l.name === 'router' && l.handle?.stack) walk(l.handle.stack, prefix + mount(l.regexp));
    }
  };
  walk((app as any)._router.stack, '');

  const { readdirSync, statSync } = await import('node:fs');
  const files: string[] = [];
  const scan = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const full = path.join(dir, f);
      if (statSync(full).isDirectory()) scan(full);
      else if (/\.(ts|tsx)$/.test(f)) files.push(full);
    }
  };
  scan(path.join(here, '../../frontend/src'));
  const missing: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:api|apiPage|download|openInline|fetchBlob)(?:<[^>]*>)?\(\s*([`'"])(\/[^\n]*)/g)) {
      let raw = m[2];
      const hole = raw.indexOf('${');
      if (hole >= 0) raw = raw.slice(0, hole); // static head of a template string
      else raw = raw.slice(0, raw.search(/[`'"]/) >= 0 ? raw.search(/[`'"]/) : raw.length);
      raw = raw.split('?')[0];
      const dynamicTail = hole >= 0 && raw.endsWith('/');
      const p = '/api' + raw.replace(/\/+$/, '');
      if (p === '/api') continue;
      const ok = dynamicTail
        ? [...routes].some((r) => r.startsWith(p + '/'))
        : routes.has(p) || routes.has(p.replace(/\/[^/]+$/, '/:p'));
      if (!ok) missing.push(`${path.basename(file)}: ${p}${dynamicTail ? '/…' : ''}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], 'frontend calls an endpoint the backend does not define');
  const { prisma } = await import('../src/config/prisma.js');
  await prisma.$disconnect();
});
