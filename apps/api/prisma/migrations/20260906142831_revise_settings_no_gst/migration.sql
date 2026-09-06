-- CreateEnum
CREATE TYPE "HandlingChargeType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "gst_rate_percent";

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "default_gst_rate_percent",
DROP COLUMN "handling_charge",
ADD COLUMN     "handling_charge_max_amount" DECIMAL(10,2),
ADD COLUMN     "handling_charge_type" "HandlingChargeType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "handling_charge_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "handling_charge_waived_until" TIMESTAMPTZ,
ADD COLUMN     "handling_charge_waiver_reason" TEXT;

