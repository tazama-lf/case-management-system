-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id","tenant_id")
);

-- CreateTable
CREATE TABLE "public"."transaction" (
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

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("end_to_end_id","tx_tp","tenant_id")
);

-- CreateIndex
CREATE INDEX "idx_tr_cre_dt_tm" ON "public"."transaction"("cre_dt_tm", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_tr_source_txtp_credttm" ON "public"."transaction"("source", "tx_tp", "cre_dt_tm", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_msg_id_tenant_id_key" ON "public"."transaction"("msg_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "public"."transaction" ADD CONSTRAINT "transaction_source_tenant_id_fkey" FOREIGN KEY ("source", "tenant_id") REFERENCES "public"."account"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaction" ADD CONSTRAINT "transaction_destination_tenant_id_fkey" FOREIGN KEY ("destination", "tenant_id") REFERENCES "public"."account"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
