-- AlterTable
ALTER TABLE "public"."alerts" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."cases" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."evidence" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."notification_logs" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."user_notification_preferences" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- AlterTable
ALTER TABLE "public"."work_queues" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
