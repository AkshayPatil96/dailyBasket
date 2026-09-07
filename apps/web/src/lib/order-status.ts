import type { OrderEventActor, OrderStatus } from '@grocery-delivery/types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAYMENT_FAILED: 'Payment failed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Same red/amber/blue/green semantics as native form-field error text
// elsewhere in this app (text-red-600 dark:text-red-400) — extended here to
// cover the other status families, since order status needs more than just
// success/error.
export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PAYMENT_FAILED: 'bg-red-500/15 text-red-700 dark:text-red-400',
  CONFIRMED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PROCESSING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PACKED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  OUT_FOR_DELIVERY: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  CANCELLED: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export const ORDER_EVENT_ACTOR_LABEL: Record<OrderEventActor, string> = {
  CUSTOMER: 'the customer',
  ADMIN: 'an admin',
  SYSTEM: 'the system',
};
