import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartSummary } from '@grocery-delivery/types';
import { cartApi } from '@/lib/cart-api';
import { useCurrentUser } from '@/hooks/use-current-user';

export const cartQueryKey = ['cart'] as const;

export function useCart() {
  const { isLoading: isLoadingUser } = useCurrentUser();
  const query = useQuery({
    queryKey: cartQueryKey,
    queryFn: cartApi.get,
    // Wait for the auth check to resolve first — fetching the cart before
    // we know whether there's a logged-in user would race the guest/user
    // cart identity the backend resolves from cookies.
    enabled: !isLoadingUser,
    staleTime: 30_000,
  });

  return {
    cart: query.data,
    itemCount: query.data?.itemCount ?? 0,
    isLoading: query.isLoading,
  };
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) =>
      cartApi.addItem(variantId, quantity),
    onSuccess: (summary: CartSummary) => queryClient.setQueryData(cartQueryKey, summary),
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartApi.updateItem(itemId, quantity),
    onSuccess: (summary: CartSummary) => queryClient.setQueryData(cartQueryKey, summary),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: (summary: CartSummary) => queryClient.setQueryData(cartQueryKey, summary),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: (summary: CartSummary) => queryClient.setQueryData(cartQueryKey, summary),
  });
}
