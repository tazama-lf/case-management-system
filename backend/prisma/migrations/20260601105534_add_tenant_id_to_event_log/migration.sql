/*
  Warnings:

  - Added the required column `tenant_id` to the `event_log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Step 1
ALTER TABLE event_log ADD COLUMN tenant_id TEXT;

-- Step 2
UPDATE event_log SET tenant_id = 'DEFAULT';

-- Step 3
ALTER TABLE event_log ALTER COLUMN tenant_id SET NOT NULL;
