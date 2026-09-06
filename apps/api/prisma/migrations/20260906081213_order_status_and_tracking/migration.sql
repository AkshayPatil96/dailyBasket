-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ORDER_CONFIRMED', 'PICKING_STARTED', 'ORDER_PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ORDER_CANCELLED');

-- CreateEnum
CREATE TYPE "OrderEventActor" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING', 'PICKING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
ALTER TABLE "public"."deliveries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "deliveries" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING ("status"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "delivery_notes" TEXT,
ADD COLUMN     "out_for_delivery_at" TIMESTAMPTZ,
ADD COLUMN     "packed_at" TIMESTAMPTZ,
ADD COLUMN     "picking_started_at" TIMESTAMPTZ,
ADD COLUMN     "updated_at" TIMESTAMPTZ,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "assigned_at" DROP NOT NULL,
ALTER COLUMN "assigned_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "message" TEXT,
    "actor_type" "OrderEventActor" NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order number sequence, used by the app (SELECT nextval('order_number_seq'))
-- to mint DB-YYYYMMDD-NNNNNN identifiers — see OrdersService.
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- AlterTable: add order_number nullable first, backfill existing rows, then
-- lock it down. A plain "ADD COLUMN ... NOT NULL" fails outright against the
-- one already-existing order row.
ALTER TABLE "orders" ADD COLUMN "order_number" TEXT;

UPDATE "orders"
SET "order_number" = 'DB-' || to_char("created_at" AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 6, '0')
WHERE "order_number" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
