import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1)
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email()
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

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
