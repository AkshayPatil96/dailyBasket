import type { Coupon, CouponDiscountType, PaginatedResponse } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface CouponInput {
  code?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  expiresAt?: string;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface AdminListCouponsParams {
  search?: string;
  isActive?: boolean;
  offset?: number;
  limit?: number;
}

export const adminCouponsApi = {
  list: (params: AdminListCouponsParams) =>
    apiClient
      .post<PaginatedResponse<Coupon>>('/coupons/admin/list', params)
      .then((res) => res.data),

  get: (id: string) => apiClient.get<Coupon>(`/coupons/admin?id=${id}`).then((res) => res.data),

  create: (input: CouponInput) =>
    apiClient.post<Coupon>('/coupons/admin', input).then((res) => res.data),

  update: (id: string, input: Partial<CouponInput>) =>
    apiClient.post<Coupon>(`/coupons/admin/update?id=${id}`, input).then((res) => res.data),
};
