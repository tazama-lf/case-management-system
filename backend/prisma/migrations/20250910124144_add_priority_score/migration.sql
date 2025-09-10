/*
  Warnings:

  - You are about to drop the column `priority_score` on the `alerts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."alerts" DROP COLUMN "priority_score";
