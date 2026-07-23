/*
  Warnings:

  - You are about to drop the column `block_reason` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `block_status` on the `alerts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "alerts" DROP COLUMN "block_reason",
DROP COLUMN "block_status";
