-- AlterTable
ALTER TABLE "deliveries" DROP COLUMN "otp_hash",
ADD COLUMN     "otp_code" TEXT;

