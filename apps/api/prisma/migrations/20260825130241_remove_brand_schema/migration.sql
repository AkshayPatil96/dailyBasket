/*
  Warnings:

  - You are about to drop the column `brand_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `brands` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_brand_id_fkey";

-- DropIndex
DROP INDEX "products_brand_id_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "brand_id",
ADD COLUMN     "brand" TEXT;

-- DropTable
DROP TABLE "brands";

-- DropEnum
DROP TYPE "BrandStatus";
