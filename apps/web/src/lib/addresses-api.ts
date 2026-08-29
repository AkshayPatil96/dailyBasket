import type { Address } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface AddressInput {
  label?: 'HOME' | 'WORK' | 'OTHER';
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  isDefault?: boolean;
}

export const addressesApi = {
  list: () => apiClient.get<Address[]>('/addresses').then((res) => res.data),

  create: (input: AddressInput) =>
    apiClient.post<Address>('/addresses', input).then((res) => res.data),

  update: (id: string, input: Partial<AddressInput>) =>
    apiClient.post<Address>(`/addresses/update?id=${id}`, input).then((res) => res.data),

  setDefault: (id: string) =>
    apiClient.post<Address>(`/addresses/set-default?id=${id}`).then((res) => res.data),

  remove: (id: string) =>
    apiClient
      .post<{ success: boolean }>(`/addresses/delete?id=${id}`)
      .then((res) => res.data),
};
