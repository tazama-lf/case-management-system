-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."CaseStatus" AS ENUM ('DRAFT', 'PENDING_CASE_CREATION', 'READY_FOR_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'SUSPENDED', 'PENDING_FINAL_APPROVAL', 'REOPENED', 'PENDING_REOPENING_APPROVAL', 'ABANDONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('NEW', 'INVESTIGATING', 'CLOSED', 'CONVERTED', 'AUTOCLOSED_REFUTED', 'AUTOCLOSED_CONFIRMED');

-- CreateEnum
CREATE TYPE "public"."CaseType" AS ENUM ('FRAUD', 'MONEY_LAUNDERING');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML');

-- CreateEnum
CREATE TYPE "public"."CaseCreationType" AS ENUM ('MANUAL', 'AUTOMATIC_SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('SUMMARY', 'DETAILED', 'FINAL');

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
    "priority" "public"."Priority" DEFAULT 'LOW',
    "alert_type" "public"."AlertType",
    "source" VARCHAR(50),
    "txtp" VARCHAR(50),
    "message" VARCHAR(100) NOT NULL,
    "alert_data" JSONB NOT NULL,
    "transaction" JSONB NOT NULL,
    "network_map" JSONB NOT NULL,
    "alert_status" "public"."AlertStatus" NOT NULL DEFAULT 'NEW',
    "confidence_per" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_id" UUID,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "public"."cases" (
    "case_id" UUID NOT NULL,
    "case_creator_user_id" UUID NOT NULL,
    "case_owner_user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "public"."CaseStatus" NOT NULL,
    "priority" "public"."Priority" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "parent_id" UUID,
    "case_type" "public"."CaseType" NOT NULL,
    "case_creation_type" "public"."CaseCreationType" NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "task_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "assigned_user_id" UUID NOT NULL,
    "name" TEXT,
    "description" TEXT,
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

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;
