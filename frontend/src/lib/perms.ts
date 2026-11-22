// Mirrors the server permission matrix (SRS 3.1) so the UI can hide controls. The API remains authoritative.
export type Role = 'OWNER' | 'ADMIN' | 'WRITER' | 'ASSISTANT' | 'ACCOUNTANT';

const ALL = [
  'customer:read', 'customer:write', 'customer:delete', 'land:read', 'land:write', 'land:delete',
  'deed:read', 'deed:write', 'deed:status', 'deed:delete', 'payment:read', 'payment:write',
  'report:deeds', 'report:payments', 'document:read', 'document:write', 'settings:read',
] as const;
export type Perm = (typeof ALL)[number];

const MAP: Record<Role, Perm[]> = {
  OWNER: [...ALL],
  ADMIN: [...ALL],
  WRITER: ['customer:read', 'customer:write', 'land:read', 'land:write', 'deed:read', 'deed:write', 'deed:status', 'document:read', 'document:write', 'report:deeds'],
  ASSISTANT: ['customer:read', 'customer:write', 'customer:delete', 'land:read', 'land:write', 'land:delete', 'deed:read', 'document:read', 'document:write'],
  ACCOUNTANT: ['customer:read', 'land:read', 'deed:read', 'payment:read', 'payment:write', 'document:read', 'report:payments'],
};

export const can = (role: Role | undefined, perm: Perm) => !!role && MAP[role].includes(perm);

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', REVIEW: 'In review', READY: 'Ready', PRINTED: 'Printed', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};
export const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Buyer', SELLER: 'Seller', DONOR: 'Donor', RECIPIENT: 'Recipient', WITNESS: 'Witness', REPRESENTATIVE: 'Representative',
};
export const PARTY_ROLES = ['BUYER', 'SELLER', 'DONOR', 'RECIPIENT', 'WITNESS', 'REPRESENTATIVE'] as const;
