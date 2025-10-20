-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ADD COLUMN     "actions" JSONB,
ADD COLUMN     "application_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "created_by" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN     "last_applied_at" TIMESTAMP(6),
ADD COLUMN     "rule_name" VARCHAR(255) NOT NULL DEFAULT 'Legacy Rule',
ADD COLUMN     "stop_on_match" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trigger_type" VARCHAR(50),
ADD COLUMN     "updated_by" UUID;

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_priority_order_idx" ON "public"."work_queue_assignment_rules"("priority_order");

-- CreateIndex
CREATE INDEX "work_queue_assignment_rules_trigger_type_idx" ON "public"."work_queue_assignment_rules"("trigger_type");
