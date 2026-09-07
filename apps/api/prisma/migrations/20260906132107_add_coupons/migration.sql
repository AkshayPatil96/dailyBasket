/*
  Warnings:

  - Changed the type of `discount_type` on the `coupons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('FLAT', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "coupon_id" TEXT;

-- AlterTable
ALTER TABLE "checkout_sessions" ADD COLUMN     "coupon_id" TEXT;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "description" TEXT,
ADD COLUMN     "max_discount_amount" DECIMAL(10,2),
ADD COLUMN     "updated_at" TIMESTAMPTZ,
ADD COLUMN     "usage_limit" INTEGER,
ADD COLUMN     "usage_limit_per_user" INTEGER,
ADD COLUMN     "used_count" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "discount_type",
ADD COLUMN     "discount_type" "CouponDiscountType" NOT NULL;

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_email" TEXT,
    "order_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_idx" ON "coupon_redemptions"("coupon_id", "user_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_guest_email_idx" ON "coupon_redemptions"("coupon_id", "guest_email");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
