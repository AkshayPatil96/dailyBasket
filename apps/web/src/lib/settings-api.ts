import type { HandlingChargeType, SystemSettings } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface UpdateSettingsInput {
  deliveryFee?: number;
  freeDeliveryThreshold?: number | null;
  handlingChargeType?: HandlingChargeType;
  handlingChargeValue?: number;
  handlingChargeMaxAmount?: number | null;
  handlingChargeWaivedUntil?: string | null;
  handlingChargeWaiverReason?: string | null;
  maintenanceMode?: boolean;
  bannerText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
}

export const settingsApi = {
  get: () => apiClient.get<SystemSettings>('/settings').then((res) => res.data),

  adminUpdate: (input: UpdateSettingsInput) =>
    apiClient.post<SystemSettings>('/settings/admin', input).then((res) => res.data),
};
