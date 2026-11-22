import type { DeedStatus, UserRole } from '@prisma/client';
import { allowedTargetStatuses } from './permissions.js';

export const STATUSES: DeedStatus[] = ['DRAFT', 'REVIEW', 'READY', 'PRINTED', 'DELIVERED', 'CANCELLED'];

/** SRS 7.1 */
export const TRANSITIONS: Record<DeedStatus, DeedStatus[]> = {
  DRAFT: ['REVIEW', 'CANCELLED'],
  REVIEW: ['DRAFT', 'READY', 'CANCELLED'],
  READY: ['PRINTED', 'REVIEW', 'CANCELLED'],
  PRINTED: ['DELIVERED', 'REVIEW'],
  DELIVERED: ['CANCELLED'],
  CANCELLED: ['DRAFT'], // owner-only audited reopen
};

/** Moves that need a stored reason (rollback, cancellation, reopen, controlled correction). */
export function needsReason(from: DeedStatus, to: DeedStatus): boolean {
  if (to === 'CANCELLED') return true;
  if (from === 'CANCELLED') return true;
  const order = ['DRAFT', 'REVIEW', 'READY', 'PRINTED', 'DELIVERED'];
  return order.indexOf(to) < order.indexOf(from);
}

export function transitionAllowedForRole(from: DeedStatus, to: DeedStatus, role: UserRole): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (!allowedTargetStatuses(role).includes(to)) return false;
  // DELIVERED -> CANCELLED and reopening CANCELLED are owner-only controlled exceptions.
  if (from === 'DELIVERED' && to === 'CANCELLED') return role === 'OWNER';
  if (from === 'CANCELLED') return role === 'OWNER';
  // Controlled correction of printed deeds.
  if (from === 'PRINTED' && to === 'REVIEW') return role === 'OWNER' || role === 'ADMIN';
  return true;
}

export const EDITABLE_STATUSES: DeedStatus[] = ['DRAFT', 'REVIEW'];
export const FINAL_STATUSES: DeedStatus[] = ['READY', 'PRINTED', 'DELIVERED'];
export const INVALID_TRANSITION_MESSAGE = 'This deed cannot move from the current status to the selected status.';
