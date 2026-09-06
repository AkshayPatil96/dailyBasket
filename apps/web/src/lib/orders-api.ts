import type { Order, PaginatedResponse } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const ordersApi = {
  list: (offset = 0, limit = 20) =>
    apiClient
      .post<PaginatedResponse<Order>>('/orders/list', { offset, limit })
      .then((res) => res.data),

  get: (orderId: string) => apiClient.get<Order>(`/orders?id=${orderId}`).then((res) => res.data),

  cancel: (orderId: string, reason?: string) =>
    apiClient.post<Order>(`/orders/cancel?id=${orderId}`, { reason }).then((res) => res.data),

  // Public — no auth required. Read-only: this never exposes a way to
  // mutate the order, only to view it.
  track: (orderNumber: string, email: string) =>
    apiClient.post<Order>('/orders/track', { orderNumber, email }).then((res) => res.data),
};
