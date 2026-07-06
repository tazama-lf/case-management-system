/*
  Convert sla_policies.target_hours to target_seconds.

  target_hours was an INTEGER, which cannot represent sub-hour SLA targets
  (e.g. a 30-minute response window) at all. Storing the target in seconds
  removes that ceiling while keeping the column an INTEGER (existing values
  stay far below the INT4 range: 168h -> 604800s).

  Step 1: rename the column in place (no application downtime requirement --
          Prisma migrate is forward-only in this project, see prior
          sla_policies migrations).
  Step 2: backfill existing hour values to their second equivalent.
*/

-- Step 1
ALTER TABLE "sla_policies" RENAME COLUMN "target_hours" TO "target_seconds";

-- Step 2
UPDATE "sla_policies" SET "target_seconds" = "target_seconds" * 3600;
