import type {
  CategoryTreeNode,
  Category,
  ProductDetail,
  ProductSummary,
  PaginatedResponse,
} from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface ListProductsParams {
  categoryId?: string;
  brand?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export const catalogApi = {
  categoryTree: () =>
    apiClient.get<CategoryTreeNode[]>('/categories/tree').then((res) => res.data),

  category: (params: { id?: string; slug?: string }) =>
    apiClient
      .get<Category>('/categories', { params })
      .then((res) => res.data),

  products: (params: ListProductsParams = {}) =>
    apiClient
      .post<PaginatedResponse<ProductSummary>>('/products/list', params)
      .then((res) => res.data),

  product: (params: { id?: string; slug?: string }) =>
    apiClient
      .get<ProductDetail>('/products', { params })
      .then((res) => res.data),
};
