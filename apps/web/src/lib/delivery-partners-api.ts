import type { DeliveryPartner, DeliveryPartnerAvailability } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const deliveryPartnersApi = {
  me: () => apiClient.get<DeliveryPartner>('/delivery-partners/me').then((res) => res.data),

  setAvailability: (availability: Extract<DeliveryPartnerAvailability, 'OFFLINE' | 'AVAILABLE'>) =>
    apiClient
      .post<DeliveryPartner>('/delivery-partners/me/availability', { availability })
      .then((res) => res.data),
};
