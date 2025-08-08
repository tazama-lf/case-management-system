/*
  Warnings:

  - You are about to drop the column `tenantId` on the `audit_log` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `audit_log` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."audit_log" DROP COLUMN "tenantId",
DROP COLUMN "username";
