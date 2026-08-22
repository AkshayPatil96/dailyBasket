export type Role = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  unit: string;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  addressId: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  items: OrderItem[];
  createdAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Array<{ field: string; message: string }>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}
