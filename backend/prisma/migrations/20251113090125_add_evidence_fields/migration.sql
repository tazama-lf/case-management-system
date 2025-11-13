-- AlterTable
ALTER TABLE "public"."evidence" ADD COLUMN     "case_id" UUID,
ADD COLUMN     "file_size" BIGINT,
ADD COLUMN     "file_type" VARCHAR(255),
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "type" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."work_queue_assignment_rules" ALTER COLUMN "created_by" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateIndex
CREATE INDEX "evidence_case_id_idx" ON "public"."evidence"("case_id");

-- CreateIndex
CREATE INDEX "evidence_evidence_hash_idx" ON "public"."evidence"("evidence_hash");

-- AddForeignKey
ALTER TABLE "public"."evidence" ADD CONSTRAINT "evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;
