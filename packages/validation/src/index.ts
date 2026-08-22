import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional()
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const addressSchema = z.object({
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional()
});
export type AddressInput = z.infer<typeof addressSchema>;

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive()
});

export const createOrderSchema = z.object({
  addressId: z.string().uuid(),
  couponCode: z.string().optional(),
  items: z.array(orderItemSchema).min(1)
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const paginationSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20)
});
export type PaginationInput = z.infer<typeof paginationSchema>;
