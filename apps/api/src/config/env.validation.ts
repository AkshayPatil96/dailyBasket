import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

export const envSchema = z.object({
  // ─────────────────────────────────────
  // App
  // ─────────────────────────────────────

  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

  APP_URL: z.string().url().default('http://localhost:3000'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ─────────────────────────────────────
  // Database - Neon PostgreSQL
  // ─────────────────────────────────────

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // ─────────────────────────────────────
  // Redis
  // ─────────────────────────────────────

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // ─────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ─────────────────────────────────────
  // Razorpay
  // ─────────────────────────────────────

  RAZORPAY_KEY_ID: z.preprocess(emptyStringToUndefined, z.string().optional()),

  RAZORPAY_KEY_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),

  RAZORPAY_WEBHOOK_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),

  // ─────────────────────────────────────
  // Google Maps
  // ─────────────────────────────────────

  GOOGLE_MAPS_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),

  // ─────────────────────────────────────
  // Resend
  // ─────────────────────────────────────

  RESEND_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),

  RESEND_FROM_EMAIL: z
    .string()
    .min(1)
    .default('DailyBasket <onboarding@resend.dev>'),

  // ─────────────────────────────────────
  // AWS S3
  // ─────────────────────────────────────

  AWS_REGION: z.string().default('ap-south-1'),

  AWS_ACCESS_KEY_ID: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),

  AWS_SECRET_ACCESS_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().optional(),
  ),

  AWS_S3_BUCKET: z.preprocess(emptyStringToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  return envSchema.parse(config);
}
