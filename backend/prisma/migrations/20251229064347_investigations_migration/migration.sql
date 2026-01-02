/*
  Warnings:

  - The values [NONE] on the enum `AlertType` will be removed. If these variants are still used in the database, this will fail.
  - The values [NONE] on the enum `CaseType` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `evidence` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `version` column on the `reports` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `work_queue_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `work_queue_member_id` column on the `work_queue_members` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AlertType_new" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML');
ALTER TABLE "public"."alerts" ALTER COLUMN "alert_type" TYPE "public"."AlertType_new" USING ("alert_type"::text::"public"."AlertType_new");
ALTER TYPE "public"."AlertType" RENAME TO "AlertType_old";
ALTER TYPE "public"."AlertType_new" RENAME TO "AlertType";
DROP TYPE "public"."AlertType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CaseType_new" AS ENUM ('FRAUD', 'AML', 'FRAUD_AND_AML');
ALTER TABLE "public"."cases" ALTER COLUMN "case_type" TYPE "public"."CaseType_new" USING ("case_type"::text::"public"."CaseType_new");
ALTER TYPE "public"."CaseType" RENAME TO "CaseType_old";
ALTER TYPE "public"."CaseType_new" RENAME TO "CaseType";
DROP TYPE "public"."CaseType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."TaskType" ADD VALUE 'SAR_STR_FILING';

-- AlterTable
ALTER TABLE "public"."evidence" DROP CONSTRAINT "evidence_pkey",
ADD COLUMN     "case_id" INTEGER,
ADD COLUMN     "file_size" BIGINT,
ADD COLUMN     "file_type" VARCHAR(255),
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "type" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "evidence_id" DROP DEFAULT,
ALTER COLUMN "evidence_id" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id");
DROP SEQUENCE "evidence_evidence_id_seq";

-- AlterTable
ALTER TABLE "public"."reports" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "version",
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."tasks" ADD COLUMN     "investigationNotes" TEXT;

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- AlterTable
ALTER TABLE "public"."work_queue_members" DROP CONSTRAINT "work_queue_members_pkey",
DROP COLUMN "work_queue_member_id",
ADD COLUMN     "work_queue_member_id" SERIAL NOT NULL,
ADD CONSTRAINT "work_queue_members_pkey" PRIMARY KEY ("work_queue_member_id");

-- CreateTable
CREATE TABLE "public"."TransactionProfile" (
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

-- CreateIndex
CREATE INDEX "evidence_case_id_idx" ON "public"."evidence"("case_id");

-- CreateIndex
CREATE INDEX "evidence_evidence_hash_idx" ON "public"."evidence"("evidence_hash");

-- AddForeignKey
ALTER TABLE "public"."evidence" ADD CONSTRAINT "evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransactionProfile" ADD CONSTRAINT "TransactionProfile_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE RESTRICT ON UPDATE CASCADE;
