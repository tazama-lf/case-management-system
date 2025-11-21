/*
  Warnings:

  - The `version` column on the `reports` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."reports" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "version",
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."tasks" ADD COLUMN     "investigationNotes" TEXT;

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';
