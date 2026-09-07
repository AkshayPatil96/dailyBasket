import type { HomepageData } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const homeApi = {
  get: () => apiClient.get<HomepageData>('/home').then((res) => res.data),
};
