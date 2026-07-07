/*
  Phase 2 of 2 for replacing the time-based Priority enum with severity-based values.

  This must run as its own migration (separate transaction from phase 1) so the
  renamed labels from phase 1 are committed before this phase depends on them.

  PostgreSQL has no `ALTER TYPE ... DROP VALUE`, so removing the now-unused BREACH
  label requires the standard rebuild dance: create a replacement type with only the
  desired labels, repoint both columns onto it via a text cast, drop the old type,
  then rename the replacement into place.
*/

CREATE TYPE "Priority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "cases" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "cases" ALTER COLUMN "priority" TYPE "Priority_new" USING ("priority"::text::"Priority_new");
ALTER TABLE "cases" ALTER COLUMN "priority" SET DEFAULT 'LOW';

ALTER TABLE "alerts" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "alerts" ALTER COLUMN "priority" TYPE "Priority_new" USING ("priority"::text::"Priority_new");
ALTER TABLE "alerts" ALTER COLUMN "priority" SET DEFAULT 'LOW';

DROP TYPE "Priority";
ALTER TYPE "Priority_new" RENAME TO "Priority";
