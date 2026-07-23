/*
  Warnings:

  - Added the required column `tenant_id` to the `case_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `task_history` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "case_history" ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "task_history" ADD COLUMN     "tenant_id" TEXT NOT NULL;
