-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('NEW', 'URGENT', 'CRITICAL', 'BREACH');

-- CreateEnum
CREATE TYPE "public"."CaseStatus" AS ENUM ('STATUS_00_DRAFT', 'STATUS_01_PENDING_CASE_CREATION_APPROVAL', 'STATUS_02_READY_FOR_ASSIGNMENT', 'STATUS_03_RETURNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_21_SUSPENDED', 'STATUS_22_PENDING_FINAL_APPROVAL', 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL', 'STATUS_71_AUTOCLOSED_CONFIRMED', 'STATUS_72_AUTOCLOSED_REFUTED', 'STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE', 'STATUS_99_ABANDONED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED', 'STATUS_21_BLOCKED');

-- CreateEnum
CREATE TYPE "public"."CaseType" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE');

-- CreateEnum
CREATE TYPE "public"."PredictionOutcome" AS ENUM ('FALSE_POSITIVE', 'TRUE_POSITIVE', 'FALSE_NEGATIVE', 'TRUE_NEGATIVE');

-- CreateEnum
CREATE TYPE "public"."CaseCreationType" AS ENUM ('MANUAL', 'AUTOMATIC_SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('SUMMARY', 'DETAILED', 'FINAL');

-- CreateEnum
CREATE TYPE "public"."TaskType" AS ENUM ('INVESTIGATION', 'APPROVAL', 'REVIEW', 'EVIDENCE_COLLECTION', 'REPORT_GENERATION', 'CASE_CLOSURE', 'ESCALATION');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'INVESTIGATOR', 'SUPERVISOR', 'ANALYST');

-- CreateEnum
CREATE TYPE "public"."AssignmentRuleType" AS ENUM ('PRIORITY_BASED', 'CASE_TYPE_BASED', 'ROUND_ROBIN', 'LOAD_BALANCED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."AssignmentType" AS ENUM ('MANUAL', 'AUTOMATIC', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_REASSIGNED', 'TASK_UNASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'SLA_WARNING', 'SLA_BREACH', 'WORK_QUEUE_ADDED', 'WORK_QUEUE_REMOVED');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'PERMANENT_FAILURE');

-- CreateTable
CREATE TABLE "public"."system_configurations" (
    "id" TEXT NOT NULL,
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
CREATE TABLE "public"."configuration_change_logs" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
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
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
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
CREATE TABLE "public"."integration_configs" (
    "id" TEXT NOT NULL,
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
CREATE TABLE "public"."audit_log" (
    "audit_log_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(255) NOT NULL,
    "outcome" VARCHAR(255) NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "alert_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "priority" "public"."Priority" DEFAULT 'NEW',
    "priority_score" DOUBLE PRECISION,
    "alert_type" "public"."AlertType",
    "prediction_outcome" "public"."PredictionOutcome" DEFAULT 'TRUE_POSITIVE',
    "source" VARCHAR(50),
    "txtp" VARCHAR(50),
    "message" VARCHAR(100) NOT NULL,
    "alert_data" JSONB NOT NULL,
    "transaction" JSONB NOT NULL,
    "network_map" JSONB NOT NULL,
    "confidence_per" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_id" UUID,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "public"."cases" (
    "case_id" UUID NOT NULL,
    "case_creator_user_id" UUID NOT NULL,
    "case_owner_user_id" UUID,
    "tenant_id" UUID NOT NULL,
    "status" "public"."CaseStatus" NOT NULL,
    "priority" "public"."Priority" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "parent_id" UUID,
    "case_type" "public"."CaseType",
    "case_creation_type" "public"."CaseCreationType" NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "task_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'STATUS_01_UNASSIGNED',
    "assigned_user_id" UUID,
    "name" TEXT,
    "description" TEXT,
    "task_type" "public"."TaskType",
    "candidateGroup" VARCHAR(50),
    "work_queue_id" UUID,
    "sla_deadline" TIMESTAMP(6),
    "sla_duration_hours" INTEGER,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "case_id" UUID,
    "task_id" UUID,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "public"."evidence" (
    "evidence_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "uploader_user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "description" VARCHAR(100) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "file_path" TEXT NOT NULL,
    "evidence_hash" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "report_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "public"."ReportType" NOT NULL,
    "report_file_path" TEXT NOT NULL,
    "report_hash" VARCHAR(255) NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "public"."work_queues" (
    "work_queue_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queues_pkey" PRIMARY KEY ("work_queue_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_roles" (
    "work_queue_role_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_queue_roles_pkey" PRIMARY KEY ("work_queue_role_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_task_types" (
    "work_queue_task_type_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "task_type" "public"."TaskType" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_queue_task_types_pkey" PRIMARY KEY ("work_queue_task_type_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_assignment_rules" (
    "assignment_rule_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "rule_name" VARCHAR(255) NOT NULL DEFAULT 'Legacy Rule',
    "rule_type" "public"."AssignmentRuleType" NOT NULL,
    "rule_config" JSONB NOT NULL,
    "trigger_type" VARCHAR(50),
    "conditions" JSONB,
    "actions" JSONB,
    "stop_on_match" BOOLEAN NOT NULL DEFAULT false,
    "priority_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "application_count" INTEGER NOT NULL DEFAULT 0,
    "last_applied_at" TIMESTAMP(6),
    "created_by" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queue_assignment_rules_pkey" PRIMARY KEY ("assignment_rule_id")
);

-- CreateTable
CREATE TABLE "public"."work_queue_members" (
    "work_queue_member_id" UUID NOT NULL,
    "work_queue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assignment_type" "public"."AssignmentType" NOT NULL DEFAULT 'MANUAL',
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "work_queue_members_pkey" PRIMARY KEY ("work_queue_member_id")
);

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
CREATE UNIQUE INDEX "system_configurations_config_key_key" ON "public"."system_configurations"("config_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_name_key" ON "public"."role_permissions"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_system_name_key" ON "public"."integration_configs"("system_name");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_case_id_key" ON "public"."alerts"("case_id");

-- CreateIndex
CREATE INDEX "tasks_work_queue_id_idx" ON "public"."tasks"("work_queue_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_sla_deadline_idx" ON "public"."tasks"("sla_deadline");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_idx" ON "public"."tasks"("assigned_user_id");

-- CreateIndex
CREATE INDEX "work_queues_tenant_id_idx" ON "public"."work_queues"("tenant_id");

-- CreateIndex
CREATE INDEX "work_queues_is_active_idx" ON "public"."work_queues"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_queues_tenant_id_name_key" ON "public"."work_queues"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "work_queue_roles_work_queue_id_idx" ON "public"."work_queue_roles"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_roles_work_queue_id_role_key" ON "public"."work_queue_roles"("work_queue_id", "role");

-- CreateIndex
CREATE INDEX "work_queue_task_types_work_queue_id_idx" ON "public"."work_queue_task_types"("work_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_task_types_work_queue_id_task_type_key" ON "public"."work_queue_task_types"("work_queue_id", "task_type");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_work_queue_id_idx" ON "public"."work_queue_assignment_rules"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_is_active_idx" ON "public"."work_queue_assignment_rules"("is_active");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_priority_order_idx" ON "public"."work_queue_assignment_rules"("priority_order");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_trigger_type_idx" ON "public"."work_queue_assignment_rules"("trigger_type");

-- CreateIndex
CREATE INDEX "work_queue_members_work_queue_id_idx" ON "public"."work_queue_members"("work_queue_id");

-- CreateIndex
CREATE INDEX "work_queue_members_user_id_idx" ON "public"."work_queue_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_queue_members_work_queue_id_user_id_key" ON "public"."work_queue_members"("work_queue_id", "user_id");

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

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_roles" ADD CONSTRAINT "work_queue_roles_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_task_types" ADD CONSTRAINT "work_queue_task_types_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_assignment_rules" ADD CONSTRAINT "work_queue_assignment_rules_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_queue_members" ADD CONSTRAINT "work_queue_members_work_queue_id_fkey" FOREIGN KEY ("work_queue_id") REFERENCES "public"."work_queues"("work_queue_id") ON DELETE CASCADE ON UPDATE CASCADE;
