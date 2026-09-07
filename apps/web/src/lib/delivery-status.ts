import type { DeliveryAssignmentOutcome, DeliveryStatus } from '@grocery-delivery/types';

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING_ASSIGNMENT: 'Waiting for assignment',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

// Same red/amber/blue/green semantics as ORDER_STATUS_BADGE_CLASS.
export const DELIVERY_STATUS_BADGE_CLASS: Record<DeliveryStatus, string> = {
  PENDING_ASSIGNMENT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ASSIGNED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  ACCEPTED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PICKED_UP: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  OUT_FOR_DELIVERY: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-700 dark:text-red-400',
  CANCELLED: 'bg-red-500/15 text-red-700 dark:text-red-400',
  FAILED: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

// States where a "Retry" (reassign) action makes sense.
export const RETRYABLE_DELIVERY_STATUSES: DeliveryStatus[] = ['REJECTED', 'FAILED'];

// A DeliveryAssignment's own outcome — distinct from the Delivery's current
// status, which multiple assignment attempts on the same delivery all share.
export const ASSIGNMENT_OUTCOME_LABEL: Record<DeliveryAssignmentOutcome, string> = {
  PENDING: 'Awaiting response',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  REASSIGNED: 'Reassigned',
  EXPIRED: 'Missed the accept window',
};

export const ASSIGNMENT_OUTCOME_BADGE_CLASS: Record<DeliveryAssignmentOutcome, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-700 dark:text-red-400',
  REASSIGNED: 'bg-(--color-muted) text-(--color-muted-foreground)',
  EXPIRED: 'bg-red-500/15 text-red-700 dark:text-red-400',
};
