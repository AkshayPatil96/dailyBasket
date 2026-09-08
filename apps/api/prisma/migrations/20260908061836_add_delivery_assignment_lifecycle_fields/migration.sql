
-- AlterTable
ALTER TABLE "delivery_assignments" ADD COLUMN     "delivered_at" TIMESTAMPTZ,
ADD COLUMN     "failed_at" TIMESTAMPTZ,
ADD COLUMN     "failure_reason" "DeliveryFailureReason",
ADD COLUMN     "out_for_delivery_at" TIMESTAMPTZ,
ADD COLUMN     "picked_up_at" TIMESTAMPTZ;

