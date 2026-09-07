import type {
  Delivery,
  DeliveryDetail,
  DeliveryListItem,
  DeliveryPartner,
  DeliveryStatus,
  UnassignedDelivery,
} from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const adminDeliveriesApi = {
  list: (status?: DeliveryStatus) =>
    apiClient
      .get<DeliveryListItem[]>('/delivery/admin/list', { params: status ? { status } : undefined })
      .then((res) => res.data),

  get: (id: string) => apiClient.get<DeliveryDetail>(`/delivery/admin?id=${id}`).then((res) => res.data),

  listUnassigned: () =>
    apiClient.get<UnassignedDelivery[]>('/delivery/admin/unassigned').then((res) => res.data),

  listAvailablePartners: () =>
    apiClient.get<DeliveryPartner[]>('/delivery/admin/available-partners').then((res) => res.data),

  assign: (deliveryId: string, deliveryPartnerId: string) =>
    apiClient
      .post<Delivery>(`/delivery/admin/assign?id=${deliveryId}`, { deliveryPartnerId })
      .then((res) => res.data),
};
