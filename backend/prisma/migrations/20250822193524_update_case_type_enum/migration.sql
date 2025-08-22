/*
  Warnings:

  - The values [INVESTIGATING] on the enum `AlertStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [MONEY_LAUNDERING] on the enum `CaseType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AlertStatus_new" AS ENUM ('NEW', 'AUTOCLOSED_CONFIRMED', 'AUTOCLOSED_REFUTED', 'CLOSED', 'CONVERTED', 'SENT_FOR_INVESTIGATION');
ALTER TABLE "public"."alerts" ALTER COLUMN "alert_status" DROP DEFAULT;
ALTER TABLE "public"."alerts" ALTER COLUMN "alert_status" TYPE "public"."AlertStatus_new" USING ("alert_status"::text::"public"."AlertStatus_new");
ALTER TYPE "public"."AlertStatus" RENAME TO "AlertStatus_old";
ALTER TYPE "public"."AlertStatus_new" RENAME TO "AlertStatus";
DROP TYPE "public"."AlertStatus_old";
ALTER TABLE "public"."alerts" ALTER COLUMN "alert_status" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CaseType_new" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML');
ALTER TABLE "public"."cases" ALTER COLUMN "case_type" TYPE "public"."CaseType_new" USING ("case_type"::text::"public"."CaseType_new");
ALTER TYPE "public"."CaseType" RENAME TO "CaseType_old";
ALTER TYPE "public"."CaseType_new" RENAME TO "CaseType";
DROP TYPE "public"."CaseType_old";
COMMIT;
