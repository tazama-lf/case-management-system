-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT,
    "date_of_birth" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id","tenant_id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_type" TEXT,
    "opened_date" TEXT,
    "balance" DECIMAL(65,30),
    "risk_rating" TEXT,
    "customer_id" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id","tenant_id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "end_to_end_id" TEXT NOT NULL,
    "tx_tp" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction" JSONB NOT NULL,
    "amt" DECIMAL(65,30),
    "ccy" TEXT,
    "msg_id" TEXT,
    "cre_dt_tm" TEXT,
    "tx_sts" TEXT,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "role" TEXT,
    "geography" VARCHAR,
    "channel" VARCHAR,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("end_to_end_id","tx_tp","tenant_id")
);

-- CreateIndex
CREATE INDEX "idx_tr_cre_dt_tm" ON "transaction"("cre_dt_tm", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_tr_source_txtp_credttm" ON "transaction"("source", "tx_tp", "cre_dt_tm", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_msg_id_tenant_id_key" ON "transaction"("msg_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "customer"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_source_tenant_id_fkey" FOREIGN KEY ("source", "tenant_id") REFERENCES "account"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_destination_tenant_id_fkey" FOREIGN KEY ("destination", "tenant_id") REFERENCES "account"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
