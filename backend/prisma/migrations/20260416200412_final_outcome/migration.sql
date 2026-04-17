-- CreateEnum
CREATE TYPE "AssignmentRuleType" AS ENUM ('PRIORITY_BASED', 'CASE_TYPE_BASED', 'ROUND_ROBIN', 'LOAD_BALANCED', 'MANUAL');

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "block_status" VARCHAR(50);

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "final_outcome" "CaseStatus";
