import type { PartyRole } from '@prisma/client';

export interface DeedTypeConfig {
  name: string;
  allowsZeroValue: boolean;
  requiredRoles: PartyRole[];
}

/** Controlled list of deed types (FR-TPL-01). Zero value is allowed only where the type permits it (BR-04). */
export const DEED_TYPES: DeedTypeConfig[] = [
  { name: 'Sale', allowsZeroValue: false, requiredRoles: ['SELLER', 'BUYER'] },
  { name: 'Gift', allowsZeroValue: true, requiredRoles: ['DONOR', 'RECIPIENT'] },
  { name: 'Agreement', allowsZeroValue: false, requiredRoles: ['SELLER', 'BUYER'] },
  { name: 'Partition', allowsZeroValue: true, requiredRoles: [] },
  { name: 'Exchange', allowsZeroValue: true, requiredRoles: [] },
  { name: 'Power of Attorney', allowsZeroValue: true, requiredRoles: ['REPRESENTATIVE'] },
  { name: 'Mortgage', allowsZeroValue: false, requiredRoles: [] },
];

export const DEED_TYPE_NAMES = DEED_TYPES.map((t) => t.name);
export const getDeedType = (name: string) => DEED_TYPES.find((t) => t.name === name);

export const PARTY_ROLES: PartyRole[] = ['BUYER', 'SELLER', 'DONOR', 'RECIPIENT', 'WITNESS', 'REPRESENTATIVE'];

export const PARTY_ROLE_BN: Record<PartyRole, string> = {
  BUYER: 'ক্রেতা',
  SELLER: 'বিক্রেতা',
  DONOR: 'দাতা',
  RECIPIENT: 'গ্রহীতা',
  WITNESS: 'সাক্ষী',
  REPRESENTATIVE: 'প্রতিনিধি',
};
