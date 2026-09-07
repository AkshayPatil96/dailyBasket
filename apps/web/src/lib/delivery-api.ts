import type { Delivery, PartnerActiveDelivery, PartnerHistoryDelivery } from '@grocery-delivery/types';
import { apiClient } from './api-client';

// Partner-facing /delivery/my/* — distinct from admin-deliveries-api.ts's
// /delivery/admin/* endpoints.
export const deliveryApi = {
  active: () =>
    apiClient.get<PartnerActiveDelivery | null>('/delivery/my/active').then((res) => res.data),

  history: () =>
    apiClient.get<PartnerHistoryDelivery[]>('/delivery/my/history').then((res) => res.data),

  accept: (deliveryId: string) =>
    apiClient.post<Delivery>(`/delivery/my/accept?id=${deliveryId}`).then((res) => res.data),

  reject: (deliveryId: string) =>
    apiClient.post<Delivery>(`/delivery/my/reject?id=${deliveryId}`).then((res) => res.data),

  pickup: (deliveryId: string) =>
    apiClient.post<Delivery>(`/delivery/my/pickup?id=${deliveryId}`).then((res) => res.data),

  start: (deliveryId: string) =>
    apiClient.post<Delivery>(`/delivery/my/start?id=${deliveryId}`).then((res) => res.data),
};
