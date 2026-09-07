import type { DeliveryPartnerAdminItem } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const adminDeliveryPartnersApi = {
  list: () =>
    apiClient.get<DeliveryPartnerAdminItem[]>('/delivery-partners/admin/list').then((res) => res.data),
};
