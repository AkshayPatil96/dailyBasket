-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "gst_rate_percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 40,
    "free_delivery_threshold" DECIMAL(10,2),
    "handling_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "default_gst_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "banner_text" TEXT,
    "support_email" TEXT,
    "support_phone" TEXT,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
