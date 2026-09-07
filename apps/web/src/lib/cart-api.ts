import type { AvailableCoupon, CartSummary } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export const cartApi = {
  get: () => apiClient.get<CartSummary>('/cart').then((res) => res.data),

  addItem: (variantId: string, quantity = 1) =>
    apiClient.post<CartSummary>('/cart/items', { variantId, quantity }).then((res) => res.data),

  updateItem: (itemId: string, quantity: number) =>
    apiClient
      .post<CartSummary>(`/cart/items/update?id=${itemId}`, { quantity })
      .then((res) => res.data),

  removeItem: (itemId: string) =>
    apiClient.post<CartSummary>(`/cart/items/delete?id=${itemId}`).then((res) => res.data),

  clear: () => apiClient.post<CartSummary>('/cart/clear').then((res) => res.data),

  applyCoupon: (code: string) =>
    apiClient.post<CartSummary>('/cart/coupon', { code }).then((res) => res.data),

  removeCoupon: () => apiClient.post<CartSummary>('/cart/coupon/remove').then((res) => res.data),

  listAvailableCoupons: () =>
    apiClient.get<AvailableCoupon[]>('/cart/coupons/available').then((res) => res.data),
};
