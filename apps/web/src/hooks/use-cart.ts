import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartSummary } from '@grocery-delivery/types';
import { cartApi } from '@/lib/cart-api';
import { useCurrentUser } from '@/hooks/use-current-user';

export const cartQueryKey = ['cart'] as const;
const availableCouponsQueryKey = ['cart', 'coupons', 'available'] as const;

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

// Subtotal-changing mutations invalidate the available-coupons list too —
// eligibility (min order value, "already used") depends on subtotal, and
// that query has its own 30s staleTime so it won't just pick up the change
// on its own the way the cart query does via setQueryData.
function useCartMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<CartSummary>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (summary: CartSummary) => {
      queryClient.setQueryData(cartQueryKey, summary);
      queryClient.invalidateQueries({ queryKey: availableCouponsQueryKey });
    },
  });
}

export function useAddToCart() {
  return useCartMutation(({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) =>
    cartApi.addItem(variantId, quantity),
  );
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) =>
    cartApi.updateItem(itemId, quantity),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => cartApi.removeItem(itemId));
}

export function useClearCart() {
  return useCartMutation<void>(() => cartApi.clear());
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon(code));
}

export function useRemoveCoupon() {
  return useCartMutation<void>(() => cartApi.removeCoupon());
}

export function useAvailableCoupons(enabled: boolean) {
  return useQuery({
    queryKey: availableCouponsQueryKey,
    queryFn: cartApi.listAvailableCoupons,
    enabled,
    staleTime: 30_000,
  });
}
