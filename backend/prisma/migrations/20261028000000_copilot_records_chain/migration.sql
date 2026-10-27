-- Tamper evidence for copilot_records: each record stores the hash of the tenant's previous record and its own hash.
-- Records written before this migration have no hash and are reported as unchained.
ALTER TABLE "copilot_records" ADD COLUMN "prev_hash" VARCHAR(64),
ADD COLUMN "hash" VARCHAR(64);
