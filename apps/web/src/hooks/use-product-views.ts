import { useMutation, useQuery } from '@tanstack/react-query';
import { productViewsApi } from '@/lib/product-views-api';

export function useRecordProductView() {
  return useMutation({ mutationFn: (productId: string) => productViewsApi.record(productId) });
}

export function useRecentlyViewed(enabled: boolean) {
  return useQuery({
    queryKey: ['product-views', 'recent'],
    queryFn: productViewsApi.recent,
    enabled,
  });
}
