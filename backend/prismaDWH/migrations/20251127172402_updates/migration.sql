/*
  Warnings:

  - You are about to drop the column `channel` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `geography` on the `transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."transaction" DROP COLUMN "channel",
DROP COLUMN "geography";
