-- AlterEnum
ALTER TYPE "public"."TaskType" ADD VALUE 'SAR_STR_FILING';

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';
