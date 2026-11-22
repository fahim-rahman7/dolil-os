import type { UserRole } from '@prisma/client';

export type Perm =
  | 'customer:read'
  | 'customer:write'
  | 'customer:delete'
  | 'land:read'
  | 'land:write'
  | 'land:delete'
  | 'deed:read'
  | 'deed:write'
  | 'deed:status'
  | 'deed:cancel'
  | 'deed:delete'
  | 'payment:read'
  | 'payment:write'
  | 'report:deeds'
  | 'report:payments'
  | 'document:read'
  | 'document:write'
  | 'settings:read'
  | 'settings:write'
  | 'user:manage';

const ALL: Perm[] = [
  'customer:read', 'customer:write', 'customer:delete',
  'land:read', 'land:write', 'land:delete',
  'deed:read', 'deed:write', 'deed:status', 'deed:cancel', 'deed:delete',
  'payment:read', 'payment:write',
  'report:deeds', 'report:payments',
  'document:read', 'document:write',
  'settings:read', 'settings:write', 'user:manage',
];

/** SRS 3.1 permission matrix. settings:write and user:manage for ADMIN depend on owner grants (see can()). */
export const ROLE_PERMS: Record<UserRole, Perm[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'settings:write' && p !== 'user:manage'),
  WRITER: [
    'customer:read', 'customer:write',
    'land:read', 'land:write',
    'deed:read', 'deed:write', 'deed:status',
    'document:read', 'document:write',
    'report:deeds',
  ],
  ASSISTANT: [
    'customer:read', 'customer:write', 'customer:delete',
    'land:read', 'land:write', 'land:delete',
    'deed:read',
    'document:read', 'document:write',
  ],
  ACCOUNTANT: [
    'customer:read', 'land:read', 'deed:read',
    'payment:read', 'payment:write',
    'document:read',
    'report:payments',
  ],
};

export const OFFICE_GRANTED: Partial<Record<Perm, 'adminCanManageSettings' | 'adminCanManageUsers'>> = {
  'settings:write': 'adminCanManageSettings',
  'user:manage': 'adminCanManageUsers',
};

export interface OfficeFlags {
  adminCanManageSettings: boolean;
  adminCanManageUsers: boolean;
}

export function can(role: UserRole, perm: Perm, office?: OfficeFlags): boolean {
  if (ROLE_PERMS[role].includes(perm)) return true;
  if (role === 'ADMIN' && office) {
    const flag = OFFICE_GRANTED[perm];
    return !!flag && office[flag];
  }
  return false;
}

/** Statuses a role may set (SRS 3.1 "Change deed status"). */
export function allowedTargetStatuses(role: UserRole): string[] {
  if (role === 'OWNER' || role === 'ADMIN') return ['DRAFT', 'REVIEW', 'READY', 'PRINTED', 'DELIVERED', 'CANCELLED'];
  if (role === 'WRITER') return ['DRAFT', 'REVIEW', 'READY'];
  return [];
}
