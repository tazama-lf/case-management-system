/*
  Warnings:

  - You are about to drop the column `finalOutcome` on the `cases` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cases" DROP COLUMN "finalOutcome",
ADD COLUMN     "final_outcome" "CaseStatus";
