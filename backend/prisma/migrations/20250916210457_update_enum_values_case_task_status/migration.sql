/*
  Warnings:

  - The values [DRAFT_00,PENDING_CASE_CREATION_APPROVAL_01,READY_FOR_ASSIGNMENT_02,RETURNED_03,ASSIGNED_10,IN_PROGRESS_20,SUSPENDED_21,PENDING_FINAL_APPROVAL_22,PENDING_REOPENING_30,REOPENED_31,AUTOCLOSED_CONFIRMED_71,AUTOCLOSED_REFUTED_72,CLOSED_REFUTED_81,CLOSED_CONFIRMED_82,CLOSED_INCONCLUSIVE_83,ABANDONED_99] on the enum `CaseStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [UNASSIGNED_01,ASSIGNED_10,IN_PROGRESS_20,COMPLETED_30,BLOCKED_21] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."AlertType" ADD VALUE 'NONE';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CaseStatus_new" AS ENUM ('STATUS_00_DRAFT', 'STATUS_01_PENDING_CASE_CREATION_APPROVAL', 'STATUS_02_READY_FOR_ASSIGNMENT', 'STATUS_03_RETURNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_21_SUSPENDED', 'STATUS_22_PENDING_FINAL_APPROVAL', 'STATUS_30_PENDING_REOPENING', 'STATUS_31_REOPENED', 'STATUS_71_AUTOCLOSED_CONFIRMED', 'STATUS_72_AUTOCLOSED_REFUTED', 'STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE', 'STATUS_99_ABANDONED');
ALTER TABLE "public"."cases" ALTER COLUMN "status" TYPE "public"."CaseStatus_new" USING ("status"::text::"public"."CaseStatus_new");
ALTER TYPE "public"."CaseStatus" RENAME TO "CaseStatus_old";
ALTER TYPE "public"."CaseStatus_new" RENAME TO "CaseStatus";
DROP TYPE "public"."CaseStatus_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."CaseType" ADD VALUE 'NONE';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TaskStatus_new" AS ENUM ('STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED', 'STATUS_21_BLOCKED');
ALTER TABLE "public"."tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."tasks" ALTER COLUMN "status" TYPE "public"."TaskStatus_new" USING ("status"::text::"public"."TaskStatus_new");
ALTER TYPE "public"."TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "public"."TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "public"."tasks" ALTER COLUMN "status" SET DEFAULT 'STATUS_01_UNASSIGNED';
COMMIT;

-- AlterTable
ALTER TABLE "public"."alerts" ALTER COLUMN "prediction_outcome" SET DEFAULT 'TRUE_POSITIVE',
ALTER COLUMN "priority_score" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."tasks" ALTER COLUMN "status" SET DEFAULT 'STATUS_01_UNASSIGNED';
