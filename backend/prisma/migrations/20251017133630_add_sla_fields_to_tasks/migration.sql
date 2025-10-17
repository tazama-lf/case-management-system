-- AlterTable
ALTER TABLE "public"."tasks" ADD COLUMN     "completed_at" TIMESTAMP(6),
ADD COLUMN     "sla_deadline" TIMESTAMP(6),
ADD COLUMN     "sla_duration_hours" INTEGER;

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_sla_deadline_idx" ON "public"."tasks"("sla_deadline");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_idx" ON "public"."tasks"("assigned_user_id");
