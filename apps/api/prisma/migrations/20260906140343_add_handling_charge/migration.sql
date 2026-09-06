-- AlterTable
ALTER TABLE "checkout_sessions" ADD COLUMN     "handling_charge" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "handling_charge" DECIMAL(10,2) NOT NULL DEFAULT 0;
