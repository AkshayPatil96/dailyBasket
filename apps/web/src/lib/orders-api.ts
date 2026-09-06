import type { Order, PaginatedResponse } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const ordersApi = {
  list: (offset = 0, limit = 20) =>
    apiClient
      .post<PaginatedResponse<Order>>('/orders/list', { offset, limit })
      .then((res) => res.data),

  get: (orderId: string) => apiClient.get<Order>(`/orders?id=${orderId}`).then((res) => res.data),
};
