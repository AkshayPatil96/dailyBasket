export type Role = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN' | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt?: string | null;
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  profileImageUrl?: string | null;
  role: Role;
  status: UserStatus;
  isSystem: boolean;
  createdAt: string;
}

export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

export interface Address {
  id: string;
  userId: string;
  label: AddressLabel;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  isDefault: boolean;
  createdAt: string;
}

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type VariantStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type Unit = 'KG' | 'G' | 'L' | 'ML' | 'PIECE' | 'PACK' | 'DOZEN';
export type DietaryTag = 'VEGETARIAN' | 'VEGAN' | 'ORGANIC' | 'GLUTEN_FREE' | 'SUGAR_FREE';

export interface Category {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  status: CategoryStatus;
  isSystem: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  skuCode: string;
  barcode?: string | null;
  label: string;
  quantity: number;
  unit: Unit;
  /** Prisma Decimal — serialized as a string over JSON, not a number. */
  price: string;
  compareAtPrice?: string | null;
  status: VariantStatus;
}

export interface CategoryBrief {
  id: string;
  name: string;
  slug: string;
}

/** Card shape returned by POST /products/list — one cheapest active variant, one primary image. */
export interface ProductSummary {
  id: string;
  categoryId: string;
  /** Plain optional label, not a managed entity — see AGENTS.md. */
  brand?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  countryOfOrigin?: string | null;
  dietaryInfo: DietaryTag[];
  status: ProductStatus;
  isFeatured: boolean;
  category: CategoryBrief;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
}

/** Full shape returned by GET /products?slug= — all active variants, all images, full category. */
export interface ProductDetail {
  id: string;
  categoryId: string;
  brand?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  ingredients?: string | null;
  nutritionalInfo?: Record<string, unknown> | null;
  dietaryInfo: DietaryTag[];
  countryOfOrigin?: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  isSystem: boolean;
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt?: string | null;
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

/** Single aggregated payload for GET /home — one round trip for the whole homepage. */
export interface HomepageData {
  categories: CategoryTreeNode[];
  popularProducts: ProductSummary[];
  featuredProducts: ProductSummary[];
  deals: ProductSummary[];
}
