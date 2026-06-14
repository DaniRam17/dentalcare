ALTER TABLE "InventoryItem" ADD COLUMN "inventoryCode" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "InventoryItem_inventoryCode_key" ON "InventoryItem"("inventoryCode");

ALTER TABLE "InventoryMovement" ADD COLUMN "stockBefore" INTEGER;
ALTER TABLE "InventoryMovement" ADD COLUMN "stockAfter" INTEGER;
ALTER TABLE "InventoryMovement" ADD COLUMN "reference" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "observations" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "userId" TEXT;

ALTER TABLE "Payment" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "cancelledAt" TIMESTAMP(3);
