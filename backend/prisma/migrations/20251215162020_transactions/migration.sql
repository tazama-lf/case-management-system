-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "public"."transaction_data" (
    "transactionId" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endToEndId" VARCHAR(50) NOT NULL,
    "transactionData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_data_pkey" PRIMARY KEY ("transactionId")
);
