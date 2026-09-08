
-- CreateEnum
CREATE TYPE "DeliveryRejectionReason" AS ENUM ('TOO_FAR', 'ALREADY_BUSY', 'VEHICLE_ISSUE', 'OTHER');

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "rejection_reason" "DeliveryRejectionReason";

-- AlterTable
ALTER TABLE "delivery_assignments" ADD COLUMN     "rejection_reason" "DeliveryRejectionReason";

