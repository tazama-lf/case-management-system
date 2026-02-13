-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NEW', 'URGENT', 'CRITICAL', 'BREACH');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('STATUS_00_DRAFT', 'STATUS_01_PENDING_CASE_CREATION_APPROVAL', 'STATUS_02_READY_FOR_ASSIGNMENT', 'STATUS_03_RETURNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_21_SUSPENDED', 'STATUS_22_PENDING_FINAL_APPROVAL', 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL', 'STATUS_71_AUTOCLOSED_CONFIRMED', 'STATUS_72_AUTOCLOSED_REFUTED', 'STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE', 'STATUS_99_ABANDONED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED', 'STATUS_21_BLOCKED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML');

-- CreateEnum
CREATE TYPE "PredictionOutcome" AS ENUM ('FALSE_POSITIVE', 'TRUE_POSITIVE', 'FALSE_NEGATIVE', 'TRUE_NEGATIVE');

-- CreateEnum
CREATE TYPE "CaseCreationType" AS ENUM ('MANUAL', 'AUTOMATIC_SYSTEM');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('SUMMARY', 'DETAILED', 'FINAL');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('INVESTIGATION', 'APPROVAL', 'REVIEW', 'EVIDENCE_COLLECTION', 'REPORT_GENERATION', 'CASE_CLOSURE', 'ESCALATION', 'SAR_STR_FILING');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INVESTIGATOR', 'SUPERVISOR', 'ANALYST');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('MANUAL', 'AUTOMATIC', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_REASSIGNED', 'TASK_UNASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'SLA_WARNING', 'SLA_BREACH', 'WORK_QUEUE_ADDED', 'WORK_QUEUE_REMOVED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'PERMANENT_FAILURE');

-- CreateEnum
CREATE TYPE "AsyncTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "system_configurations" (
    "id" SERIAL NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" JSONB NOT NULL,
    "config_type" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_change_logs" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "config_key" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB NOT NULL,
    "change_type" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "requires_2fa" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approval_date" TIMESTAMP(3),
    "change_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" SERIAL NOT NULL,
    "system_name" TEXT NOT NULL,
    "endpoint_url" TEXT,
    "api_key" TEXT,
    "api_secret" TEXT,
    "config_data" JSONB,
    "auth_type" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "test_status" TEXT,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "audit_log_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(1000) NOT NULL,
    "outcome" VARCHAR(255) NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "alert_id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "priority" "Priority" DEFAULT 'NEW',
    "priority_score" DOUBLE PRECISION,
    "alert_type" "CaseType",
    "prediction_outcome" "PredictionOutcome" DEFAULT 'TRUE_POSITIVE',
    "source" VARCHAR(50),
    "txtp" VARCHAR(50) NOT NULL,
    "message" VARCHAR(100) NOT NULL,
    "alert_data" JSONB NOT NULL,
    "transaction" JSONB NOT NULL,
    "network_map" JSONB NOT NULL,
    "confidence_per" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_id" INTEGER,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "cases" (
    "case_id" SERIAL NOT NULL,
    "case_creator_user_id" UUID NOT NULL,
    "case_owner_user_id" UUID,
    "tenant_id" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "parent_id" INTEGER,
    "case_type" "CaseType",
    "case_creation_type" "CaseCreationType" NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "task_id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'STATUS_01_UNASSIGNED',
    "assigned_user_id" UUID,
    "name" TEXT,
    "description" TEXT,
    "investigationNotes" TEXT,
    "task_type" "TaskType",
    "candidateGroup" VARCHAR(50),
    "sla_deadline" TIMESTAMP(6),
    "sla_duration_hours" INTEGER,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "comment_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "case_id" INTEGER,
    "task_id" INTEGER,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "evidence_id" VARCHAR(255) NOT NULL,
    "task_id" INTEGER NOT NULL,
    "case_id" INTEGER NOT NULL,
    "uploader_user_id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "type" VARCHAR(50) NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" BIGINT,
    "file_type" VARCHAR(255),
    "evidence_hash" TEXT NOT NULL,
    "metadata" JSONB,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "report_id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "report_file_path" TEXT NOT NULL,
    "report_hash" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "TransactionProfile" (
    "profile_id" TEXT NOT NULL,
    "case_id" INTEGER NOT NULL,
    "generated_by" UUID NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filters" JSONB,
    "metrics" JSONB,
    "outliers" JSONB,
    "summary_table" JSONB,
    "notes" TEXT,
    "visualization" TEXT,
    "detected_anomalies" JSONB,

    CONSTRAINT "TransactionProfile_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "transaction_data" (
    "transactionId" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endToEndId" VARCHAR(50) NOT NULL,
    "transactionData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_data_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "reference_ids" (
    "id" SERIAL NOT NULL,
    "txTp" VARCHAR(50) NOT NULL,
    "referenceIdName" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "preference_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dashboard_enabled" BOOLEAN NOT NULL DEFAULT true,
    "phone_number" VARCHAR(20),
    "suppression_settings" JSONB,
    "default_channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("preference_id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "notification_log_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "task_id" INTEGER,
    "case_id" INTEGER,
    "notification_type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
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

-- CreateTable
CREATE TABLE "async_tasks" (
    "task_id" SERIAL NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "created_by" VARCHAR(100),

    CONSTRAINT "async_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "event_log_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(1000) NOT NULL,
    "outcome" VARCHAR(255) NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("event_log_id")
);

-- CreateTable
CREATE TABLE "task_history" (
    "task_history_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(1000) NOT NULL,
    "case_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_pkey" PRIMARY KEY ("task_history_id")
);

-- CreateTable
CREATE TABLE "case_history" (
    "case_history_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(1000) NOT NULL,
    "case_id" INTEGER NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_history_pkey" PRIMARY KEY ("case_history_id")
);

-- CreateTable
CREATE TABLE "filters" (
    "filter_Id" SERIAL NOT NULL,
    "user_Id" UUID NOT NULL,
    "filter_type" VARCHAR(50) NOT NULL,
    "user_filters" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "filters_pkey" PRIMARY KEY ("filter_Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configurations_config_key_key" ON "system_configurations"("config_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_name_key" ON "role_permissions"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_system_name_key" ON "integration_configs"("system_name");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_case_id_key" ON "alerts"("case_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_sla_deadline_idx" ON "tasks"("sla_deadline");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_idx" ON "tasks"("assigned_user_id");

-- CreateIndex
CREATE INDEX "evidence_case_id_idx" ON "evidence"("case_id");

-- CreateIndex
CREATE INDEX "evidence_evidence_hash_idx" ON "evidence"("evidence_hash");

-- CreateIndex
CREATE UNIQUE INDEX "reference_ids_txTp_key" ON "reference_ids"("txTp");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_user_id_idx" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_tenant_id_idx" ON "user_notification_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_notification_type_idx" ON "notification_logs"("user_id", "notification_type");

-- CreateIndex
CREATE INDEX "notification_logs_task_id_idx" ON "notification_logs"("task_id");

-- CreateIndex
CREATE INDEX "notification_logs_case_id_idx" ON "notification_logs"("case_id");

-- CreateIndex
CREATE INDEX "notification_logs_delivery_status_idx" ON "notification_logs"("delivery_status");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_read_at_idx" ON "notification_logs"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "async_tasks_status_idx" ON "async_tasks"("status");

-- CreateIndex
CREATE INDEX "async_tasks_task_type_idx" ON "async_tasks"("task_type");

-- CreateIndex
CREATE INDEX "async_tasks_next_retry_at_idx" ON "async_tasks"("next_retry_at");

-- CreateIndex
CREATE INDEX "async_tasks_created_at_idx" ON "async_tasks"("created_at");

-- CreateIndex
CREATE INDEX "async_tasks_status_task_type_next_retry_at_idx" ON "async_tasks"("status", "task_type", "next_retry_at");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProfile" ADD CONSTRAINT "TransactionProfile_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
