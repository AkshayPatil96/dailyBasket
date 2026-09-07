import type { Order, OrderStatus, PaginatedResponse } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface AdminListOrdersParams {
  status?: OrderStatus;
  search?: string;
  offset?: number;
  limit?: number;
}

export const adminOrdersApi = {
  list: (params: AdminListOrdersParams) =>
    apiClient
      .post<PaginatedResponse<Order>>('/orders/admin/list', params)
      .then((res) => res.data),

  get: (orderId: string) =>
    apiClient.get<Order>(`/orders/admin?id=${orderId}`).then((res) => res.data),

  updateStatus: (orderId: string, status: OrderStatus, reason?: string) =>
    apiClient
      .post<Order>(`/orders/admin/status?id=${orderId}`, { status, reason })
      .then((res) => res.data),
};
