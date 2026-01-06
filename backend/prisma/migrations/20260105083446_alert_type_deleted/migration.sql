/*
  Warnings:

  - The `alert_type` column on the `alerts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "alerts" DROP COLUMN "alert_type",
ADD COLUMN     "alert_type" "CaseType";

-- AlterTable
ALTER TABLE "work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- DropEnum
DROP TYPE "AlertType";
