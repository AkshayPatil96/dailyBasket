import type { ProductSummary } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const productViewsApi = {
  record: (productId: string) =>
    apiClient.post('/product-views', { productId }).then((res) => res.data),

  recent: () =>
    apiClient.get<ProductSummary[]>('/product-views/recent').then((res) => res.data),
};
