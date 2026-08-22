interface AppConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  corsOrigin: string;
}

interface DatabaseConfig {
  url: string | undefined;
  directUrl: string | undefined;
}

interface RedisConfig {
  url: string | undefined;
}

interface JwtConfig {
  secret: string | undefined;
  refreshSecret: string | undefined;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

interface RazorpayConfig {
  keyId: string | undefined;
  keySecret: string | undefined;
  webhookSecret: string | undefined;
}

interface GoogleMapsConfig {
  apiKey: string | undefined;
}

interface ResendConfig {
  apiKey: string | undefined;
  fromEmail: string;
}

interface AwsConfig {
  region: string;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  s3Bucket: string | undefined;
}

interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  razorpay: RazorpayConfig;
  googleMaps: GoogleMapsConfig;
  resend: ResendConfig;
  aws: AwsConfig;
}

export default (): AppConfiguration => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3001),
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },

  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail:
      process.env.RESEND_FROM_EMAIL ?? 'DailyBasket <onboarding@resend.dev>',
  },

  aws: {
    region: process.env.AWS_REGION ?? 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
});
