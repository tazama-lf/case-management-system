-- AlterTable
ALTER TABLE "public"."account" ADD COLUMN     "account_type" TEXT,
ADD COLUMN     "balance" DECIMAL(65,30),
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "opened_date" TEXT,
ADD COLUMN     "risk_rating" TEXT;

-- CreateTable
CREATE TABLE "public"."customer" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT,
    "date_of_birth" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id","tenant_id")
);

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "public"."customer"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
