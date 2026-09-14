/*
  Case-level access control (ACL) — plan .claude/plans/wild-dreaming-dewdrop.md §1
  (design background: docs/case-acl-design.md).

  Two tables:
    - case_investigators            (whitelist)
    - case_investigators_blacklist  (exclusion list)

  Both are populated exclusively by task assignment (plan §3, task-only —
  Case.case_owner_user_id is not read by the ACL) — there is no manual-add
  endpoint, for anyone, supervisor included. Supervisors retain revoke /
  blacklist / unblock.

  IMPORTANT — partial unique indexes, not plain UNIQUE constraints:
  "One live row per (case_id, user_id)" cannot be enforced by a plain
  UNIQUE(case_id, user_id, revoked_at) the way an earlier draft of the
  design proposed — Postgres treats every NULL as distinct from every other
  NULL, so a plain unique constraint including the nullable revoked_at /
  unblocked_at column would silently allow multiple simultaneously-live
  rows for the same (case_id, user_id), which is the opposite of what's
  needed. The two CREATE UNIQUE INDEX ... WHERE statements below are the
  real constraint. This is why schema.prisma only declares plain @@index
  for these two tables — Prisma's schema DSL cannot express a partial
  index, so it's hand-written here instead of generated.
*/

-- CreateEnum
CREATE TYPE "CaseInvestigatorMembership" AS ENUM ('LEAD', 'OBSERVER');

-- CreateTable
CREATE TABLE "case_investigators" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
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
-- Same reasoning as above — "one live block per (case, user)".
CREATE UNIQUE INDEX "case_investigators_blacklist_case_id_user_id_live_key"
  ON "case_investigators_blacklist"("case_id", "user_id")
  WHERE "unblocked_at" IS NULL;

-- CreateIndex
CREATE INDEX "case_investigators_blacklist_case_id_user_id_idx" ON "case_investigators_blacklist"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "case_investigators_blacklist_user_id_idx" ON "case_investigators_blacklist"("user_id");

-- AddForeignKey
ALTER TABLE "case_investigators" ADD CONSTRAINT "case_investigators_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_investigators_blacklist" ADD CONSTRAINT "case_investigators_blacklist_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
