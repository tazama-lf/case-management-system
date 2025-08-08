-- CreateTable
CREATE TABLE "public"."audit_log" (
    "audit_log_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "username" TEXT,
    "operation" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "action_performed" VARCHAR(255) NOT NULL,
    "outcome" VARCHAR(255) NOT NULL,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_log_id")
);
