-- CreateEnum
CREATE TYPE "AIOrderProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'PROCESSING', 'COMPLETED');

-- CreateTable
CREATE TABLE "AIOrderProposal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "conversationId" TEXT,
    "orderId" TEXT NOT NULL,
    "matchedProductId" TEXT NOT NULL,
    "status" "AIOrderProposalStatus" NOT NULL DEFAULT 'PENDING',
    "rawMessage" TEXT NOT NULL,
    "extractedIntent" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "customerMatchConfidence" DOUBLE PRECISION,
    "productMatchConfidence" DOUBLE PRECISION,
    "requestedQuantity" INTEGER NOT NULL,
    "availableInventory" INTEGER NOT NULL,
    "proposedUnitPrice" DECIMAL(14,2) NOT NULL,
    "proposedTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    CONSTRAINT "AIOrderProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIOrderProposal_orderId_key" ON "AIOrderProposal"("orderId");
CREATE INDEX "AIOrderProposal_businessId_status_createdAt_idx" ON "AIOrderProposal"("businessId", "status", "createdAt");
CREATE INDEX "AIOrderProposal_customerId_idx" ON "AIOrderProposal"("customerId");
CREATE INDEX "AIOrderProposal_matchedProductId_idx" ON "AIOrderProposal"("matchedProductId");

ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIOrderProposal" ADD CONSTRAINT "AIOrderProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;