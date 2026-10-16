
-- CreateEnum
CREATE TYPE "CaseInvestigatorMembership" AS ENUM ('LEAD', 'OBSERVER');

-- CreateTable
CREATE TABLE "case_investigators" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "membership" "CaseInvestigatorMembership" NOT NULL DEFAULT 'OBSERVER',
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(6),
    "revoked_by" UUID,
    "revoke_reason" VARCHAR(1000),

    CONSTRAINT "case_investigators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_investigators_blacklist" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "blocked_by" UUID NOT NULL,
    "blocked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "block_reason" VARCHAR(1000) NOT NULL,
    "unblocked_at" TIMESTAMP(6),
    "unblocked_by" UUID,
    "unblock_reason" VARCHAR(1000),

    CONSTRAINT "case_investigators_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The real "one live row per (case, user)" constraint — hand-written, see
-- the header comment above for why this can't be a plain UNIQUE.
CREATE UNIQUE INDEX "case_investigators_case_id_user_id_live_key"
  ON "case_investigators"("case_id", "user_id")
  WHERE "revoked_at" IS NULL;

-- CreateIndex
CREATE INDEX "case_investigators_case_id_user_id_idx" ON "case_investigators"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "case_investigators_user_id_idx" ON "case_investigators"("user_id");

-- CreateIndex
CREATE INDEX "case_investigators_tenant_id_idx" ON "case_investigators"("tenant_id");

-- CreateIndex
-- Same reasoning as above — "one live block per (case, user)".
CREATE UNIQUE INDEX "case_investigators_blacklist_case_id_user_id_live_key"
  ON "case_investigators_blacklist"("case_id", "user_id")
  WHERE "unblocked_at" IS NULL;

-- CreateIndex
CREATE INDEX "case_investigators_blacklist_case_id_user_id_idx" ON "case_investigators_blacklist"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "case_investigators_blacklist_user_id_idx" ON "case_investigators_blacklist"("user_id");

-- CreateIndex
CREATE INDEX "case_investigators_blacklist_tenant_id_idx" ON "case_investigators_blacklist"("tenant_id");

-- AddForeignKey
ALTER TABLE "case_investigators" ADD CONSTRAINT "case_investigators_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_investigators_blacklist" ADD CONSTRAINT "case_investigators_blacklist_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
