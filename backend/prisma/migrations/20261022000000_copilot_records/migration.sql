-- CreateTable
CREATE TABLE "copilot_records" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "parent_id" INTEGER,
    "created_by" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(200),
    "embedding_model" VARCHAR(200),
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_records_case_id_kind_idx" ON "copilot_records"("case_id", "kind");

-- CreateIndex
CREATE INDEX "copilot_records_tenant_id_idx" ON "copilot_records"("tenant_id");
