-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_REASSIGNED', 'TASK_UNASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'SLA_WARNING', 'SLA_BREACH', 'WORK_QUEUE_ADDED', 'WORK_QUEUE_REMOVED');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'PERMANENT_FAILURE');

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "public"."user_notification_preferences" (
    "preference_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dashboard_enabled" BOOLEAN NOT NULL DEFAULT true,
    "phone_number" VARCHAR(20),
    "suppression_settings" JSONB,
    "default_channel" "public"."NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("preference_id")
);

-- CreateTable
CREATE TABLE "public"."notification_logs" (
    "notification_log_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "task_id" UUID,
    "case_id" UUID,
    "notification_type" "public"."NotificationType" NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "delivery_status" "public"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(6),
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("notification_log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "public"."user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_user_id_idx" ON "public"."user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_tenant_id_idx" ON "public"."user_notification_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_notification_type_idx" ON "public"."notification_logs"("user_id", "notification_type");

-- CreateIndex
CREATE INDEX "notification_logs_task_id_idx" ON "public"."notification_logs"("task_id");

-- CreateIndex
CREATE INDEX "notification_logs_case_id_idx" ON "public"."notification_logs"("case_id");

-- CreateIndex
CREATE INDEX "notification_logs_delivery_status_idx" ON "public"."notification_logs"("delivery_status");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "public"."notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_read_at_idx" ON "public"."notification_logs"("user_id", "read_at");
