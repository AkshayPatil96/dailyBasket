import type {
  Category,
  ProductDetail,
  ProductVariant,
  ProductImage,
  ProductStatus,
  CategoryStatus,
  VariantStatus,
  Unit,
  DietaryTag,
  PaginatedResponse,
} from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface CategoryInput {
  name: string;
  parentId?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: CategoryStatus;
}

export interface ProductInput {
  categoryId: string;
  brand?: string;
  name: string;
  description?: string;
  ingredients?: string;
  dietaryInfo?: DietaryTag[];
  countryOfOrigin?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
}

export interface AdminListProductsParams {
  status?: ProductStatus;
  categoryId?: string;
  brand?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface VariantInput {
  productId?: string;
  skuCode?: string;
  barcode?: string;
  label: string;
  quantity: number;
  unit: Unit;
  price: number;
  compareAtPrice?: number;
  status?: VariantStatus;
}

export const adminCategoriesApi = {
  listAll: () => apiClient.get<Category[]>('/categories/all').then((res) => res.data),

  create: (input: CategoryInput) =>
    apiClient.post<Category>('/categories', input).then((res) => res.data),

  update: (id: string, input: Partial<CategoryInput>) =>
    apiClient.post<Category>(`/categories/update?id=${id}`, input).then((res) => res.data),

  remove: (id: string) =>
    apiClient
      .post<{ success: boolean }>(`/categories/delete?id=${id}`)
      .then((res) => res.data),
};

export const adminProductsApi = {
  list: (params: AdminListProductsParams = {}) =>
    apiClient
      .post<PaginatedResponse<ProductDetail>>('/products/admin/list', params)
      .then((res) => res.data),

  findOne: (id: string) =>
    apiClient.get<ProductDetail>('/products/admin', { params: { id } }).then((res) => res.data),

  create: (input: ProductInput) =>
    apiClient.post<ProductDetail>('/products', input).then((res) => res.data),

  update: (id: string, input: Partial<ProductInput>) =>
    apiClient.post<ProductDetail>(`/products/update?id=${id}`, input).then((res) => res.data),

  remove: (id: string) =>
    apiClient.post<{ success: boolean }>(`/products/delete?id=${id}`).then((res) => res.data),

  createVariant: (input: VariantInput) =>
    apiClient.post<ProductVariant>('/products/variants', input).then((res) => res.data),

  updateVariant: (id: string, input: Partial<VariantInput>) =>
    apiClient
      .post<ProductVariant>(`/products/variants/update?id=${id}`, input)
      .then((res) => res.data),

  addImage: (input: { productId: string; url: string; altText?: string; isPrimary?: boolean }) =>
    apiClient.post<ProductImage>('/products/images', input).then((res) => res.data),

  removeImage: (id: string) =>
    apiClient
      .post<{ success: boolean }>(`/products/images/delete?id=${id}`)
      .then((res) => res.data),
};
