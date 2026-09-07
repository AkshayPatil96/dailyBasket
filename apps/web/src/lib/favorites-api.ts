import type { ProductSummary } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const favoritesApi = {
  list: () => apiClient.get<ProductSummary[]>('/favorites').then((res) => res.data),

  ids: () => apiClient.get<string[]>('/favorites/ids').then((res) => res.data),

  add: (productId: string) =>
    apiClient.post('/favorites', { productId }).then((res) => res.data),

  remove: (productId: string) =>
    apiClient.post('/favorites/remove', { productId }).then((res) => res.data),
};
