export type Role = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN' | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type CheckoutSessionStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

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
  /** Only present on admin responses (adminFindOne/adminList) — customer-facing includes omit it. */
  inventory?: { quantity: number; reservedQuantity: number; reorderLevel: number };
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

export interface CartItemSummary {
  id: string;
  variantId: string;
  quantity: number;
  /** Current catalog price — the cart never persists a price snapshot, see AGENTS.md cart doc. */
  currentPrice: number;
  lineTotal: number;
  product: { id: string; name: string; slug: string; imageUrl: string | null };
  variant: {
    id: string;
    label: string;
    unit: Unit;
    price: number;
    compareAtPrice: number | null;
    status: VariantStatus;
  };
  availability: { inStock: boolean; availableQuantity: number };
}

/** Calculated view returned by every /cart endpoint — backend is the totals authority. */
export interface CartSummary {
  cartId: string | null;
  items: CartItemSummary[];
  itemCount: number;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  handlingCharge: number;
  handlingChargeOriginalAmount: number;
  handlingChargeWaived: boolean;
  handlingChargeWaiverReason: string | null;
  deliveryFee: number;
  deliveryFeeOriginalAmount: number;
  total: number;
}

export type CouponDiscountType = 'FLAT' | 'PERCENTAGE';

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: CouponDiscountType;
  /** Prisma Decimal — serialized as a string over JSON, not a number. */
  discountValue: string;
  maxDiscountAmount?: string | null;
  minOrderValue?: string | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AvailableCoupon {
  coupon: Coupon;
  eligible: boolean;
  reason?: string;
}

export type HandlingChargeType = 'FIXED' | 'PERCENTAGE';

/** Singleton admin-config row — see dailybasket-cart-architecture.md for the pricing model. */
export interface SystemSettings {
  id: string;
  /** Prisma Decimal — serialized as a string over JSON, not a number. */
  deliveryFee: string;
  freeDeliveryThreshold?: string | null;
  handlingChargeType: HandlingChargeType;
  handlingChargeValue: string;
  handlingChargeMaxAmount?: string | null;
  handlingChargeWaivedUntil?: string | null;
  handlingChargeWaiverReason?: string | null;
  maintenanceMode: boolean;
  bannerText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  updatedAt?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  /** Prisma Decimal — serialized as a string over JSON, not a number. */
  unitPrice: string;
  discount: string;
  lineTotal: string;
}

export type DeliveryStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export type DeliveryPartnerStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type DeliveryPartnerAvailability = 'OFFLINE' | 'AVAILABLE' | 'BUSY';
export type DeliveryFailureReason =
  | 'CUSTOMER_UNAVAILABLE'
  | 'WRONG_ADDRESS'
  | 'CUSTOMER_REFUSED'
  | 'UNABLE_TO_CONTACT'
  | 'OTHER';
export type DeliveryAssignmentOutcome = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REASSIGNED';

export type OrderEventType =
  | 'ORDER_PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_CONFIRMED'
  | 'PICKING_STARTED'
  | 'ORDER_PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'ORDER_CANCELLED';

export type OrderEventActor = 'CUSTOMER' | 'ADMIN' | 'SYSTEM';

export interface Delivery {
  id: string;
  orderId: string;
  deliveryPartnerId?: string | null;
  status: DeliveryStatus;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationAt?: string | null;
  deliveryNotes?: string | null;
  otpExpiresAt?: string | null;
  failureReason?: DeliveryFailureReason | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deliveryPartner?: DeliveryPartner | null;
}

export interface DeliveryPartner {
  id: string;
  userId: string;
  status: DeliveryPartnerStatus;
  availabilityStatus: DeliveryPartnerAvailability;
  availableSince?: string | null;
  lastSeenAt?: string | null;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'phone'>;
}

/** GET /delivery-partners/admin/list — same shape, but with email too. */
export interface DeliveryPartnerAdminItem extends DeliveryPartner {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'phone' | 'email'>;
}

export interface DeliveryAssignment {
  id: string;
  deliveryId: string;
  deliveryPartnerId: string;
  outcome: DeliveryAssignmentOutcome;
  assignedAt: string;
  respondedAt?: string | null;
}

export interface DeliveryOrderSummary {
  id: string;
  orderNumber: string;
  recipientName: string;
  phone: string;
  city: string;
  state: string;
  total: string;
  createdAt: string;
}

/** GET /delivery/admin/unassigned — a Delivery still PENDING_ASSIGNMENT for a PACKED order. */
export interface UnassignedDelivery {
  id: string;
  status: DeliveryStatus;
  createdAt: string;
  order: DeliveryOrderSummary;
}

/** GET /delivery/admin/list — the full operational view, every delivery. */
export interface DeliveryListItem extends Delivery {
  order: DeliveryOrderSummary;
}

/** GET /delivery/admin?id= — a DeliveryListItem plus its full assignment history. */
export interface DeliveryDetail extends DeliveryListItem {
  assignments: (DeliveryAssignment & {
    deliveryPartner: { user: Pick<User, 'firstName' | 'lastName'> };
  })[];
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  message?: string | null;
  actorType: OrderEventActor;
  actorId?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string | null;
  addressId?: string | null;
  couponId?: string | null;
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
  guestEmail?: string | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  tax: string;
  total: string;
  createdAt: string;
  updatedAt?: string | null;
  items: OrderItem[];
  payment?: Payment | null;
  delivery?: Delivery | null;
  events?: OrderEvent[];
}

/** GET /orders/buy-again — distinct products from past orders, most recently ordered first. */
export interface BuyAgainItem {
  product: ProductSummary;
  lastOrderedAt: string;
  lastQuantity: number;
}

export interface Payment {
  id: string;
  orderId?: string | null;
  checkoutSessionId?: string | null;
  provider: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status: PaymentStatus;
  /** Prisma Decimal — serialized as a string over JSON, not a number. */
  amount: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CheckoutSession {
  id: string;
  cartId: string;
  userId?: string | null;
  guestEmail?: string | null;
  status: CheckoutSessionStatus;
  savedAddressId?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  tax: string;
  total: string;
  orderId?: string | null;
  expiresAt: string;
  reservationExpiresAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

/** Response of POST /checkout/payment/create — feeds the Razorpay Checkout widget directly. */
export interface CreatePaymentResult {
  checkoutSessionId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
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
