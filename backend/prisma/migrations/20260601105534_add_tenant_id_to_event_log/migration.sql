/*
  Warnings:

  - Added the required column `tenant_id` to the `event_log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event_log" ADD COLUMN     "tenant_id" TEXT NOT NULL;
