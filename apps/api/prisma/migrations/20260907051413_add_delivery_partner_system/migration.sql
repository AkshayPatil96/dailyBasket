-- CreateEnum
CREATE TYPE "DeliveryPartnerStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeliveryPartnerAvailability" AS ENUM ('OFFLINE', 'AVAILABLE', 'BUSY');

-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'CUSTOMER_REFUSED', 'UNABLE_TO_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'REASSIGNED');

-- AlterEnum
-- Old values with no new counterpart (PENDING, PICKING, PACKED) are remapped
-- to PENDING_ASSIGNMENT before the cast, since existing rows use PACKED.
BEGIN;
CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED', 'FAILED');
ALTER TABLE "public"."deliveries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "deliveries" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'PENDING_ASSIGNMENT'
    WHEN 'PICKING' THEN 'PENDING_ASSIGNMENT'
    WHEN 'PACKED' THEN 'PENDING_ASSIGNMENT'
    ELSE "status"::text
  END
)::"DeliveryStatus_new";
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING_ASSIGNMENT';
COMMIT;

-- AlterTable
ALTER TABLE "deliveries" DROP COLUMN "packed_at",
DROP COLUMN "picking_started_at",
ADD COLUMN     "accepted_at" TIMESTAMPTZ,
ADD COLUMN     "failed_at" TIMESTAMPTZ,
ADD COLUMN     "failure_reason" "DeliveryFailureReason",
ADD COLUMN     "last_location_at" TIMESTAMPTZ,
ADD COLUMN     "otp_expires_at" TIMESTAMPTZ,
ADD COLUMN     "otp_hash" TEXT,
ADD COLUMN     "picked_up_at" TIMESTAMPTZ,
ALTER COLUMN "status" SET DEFAULT 'PENDING_ASSIGNMENT';

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "DeliveryPartnerStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "availability_status" "DeliveryPartnerAvailability" NOT NULL DEFAULT 'OFFLINE',
    "available_since" TIMESTAMP(3),
    "vehicle_type" TEXT,
    "vehicle_number" TEXT,
    "current_latitude" DOUBLE PRECISION,
    "current_longitude" DOUBLE PRECISION,
    "last_location_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "delivery_partner_id" TEXT NOT NULL,
    "outcome" "DeliveryAssignmentOutcome" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_user_id_key" ON "delivery_partners"("user_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_delivery_id_idx" ON "delivery_assignments"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_delivery_partner_id_idx" ON "delivery_assignments"("delivery_partner_id");

-- CreateIndex
CREATE INDEX "deliveries_delivery_partner_id_idx" ON "deliveries"("delivery_partner_id");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
