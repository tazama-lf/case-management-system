/*
  Renames the per-case "blacklist" to "blocklist" and "whitelist" to "allowlist"

  - Table, sequence, primary key, foreign key and indexes of case_investigators_blacklist are
    renamed to the names Prisma derives for case_investigators_blocklist, so `prisma migrate dev`
    reports no drift. The partial unique "one live block per (case, user)" index keeps its
    definition, only its name changes.
  - case_investigators.revoke_reason = 'blacklisted' (written when a block revokes the allowlist
    row) becomes 'blocklisted', which is what the code now writes and reads.
  - Free-text history/comment rows that mention "blacklisted" are left alone: they are audit
    records of what was written at the time.

  Runs in one transaction. Reverse by renaming everything back and restoring the value.

  Deploy: NOT backward compatible. Stop the old backend before applying this and start the new
  build only after it completes - the old build queries case_investigators_blacklist, the new one case_investigators_blocklist.
*/

-- RenameTable
ALTER TABLE "case_investigators_blacklist" RENAME TO "case_investigators_blocklist";

-- RenameSequence
ALTER SEQUENCE "case_investigators_blacklist_id_seq" RENAME TO "case_investigators_blocklist_id_seq";

-- RenameConstraint (also renames the primary key's backing index)
ALTER TABLE "case_investigators_blocklist" RENAME CONSTRAINT "case_investigators_blacklist_pkey" TO "case_investigators_blocklist_pkey";
ALTER TABLE "case_investigators_blocklist" RENAME CONSTRAINT "case_investigators_blacklist_case_id_fkey" TO "case_investigators_blocklist_case_id_fkey";

-- RenameIndex
ALTER INDEX "case_investigators_blacklist_case_id_user_id_live_key" RENAME TO "case_investigators_blocklist_case_id_user_id_live_key";
ALTER INDEX "case_investigators_blacklist_case_id_user_id_idx" RENAME TO "case_investigators_blocklist_case_id_user_id_idx";
ALTER INDEX "case_investigators_blacklist_user_id_idx" RENAME TO "case_investigators_blocklist_user_id_idx";
ALTER INDEX "case_investigators_blacklist_tenant_id_idx" RENAME TO "case_investigators_blocklist_tenant_id_idx";

-- UpdateData
UPDATE "case_investigators" SET "revoke_reason" = 'blocklisted' WHERE "revoke_reason" = 'blacklisted';
