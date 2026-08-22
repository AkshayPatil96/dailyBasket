export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  ADMIN: 'ADMIN'
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
} as const;

export const API_V1_PREFIX = '/api/v1';

export const ROUTES = {
  customer: '/',
  admin: '/admin',
  delivery: '/delivery'
} as const;
