-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "formatted_address" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "recipient_name" TEXT NOT NULL,
DROP COLUMN "label",
ADD COLUMN     "label" "AddressLabel" NOT NULL DEFAULT 'HOME';

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

