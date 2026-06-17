-- CreateTable
CREATE TABLE "cms_usernames" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "cms_usernames_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_usernames_user_id_key" ON "cms_usernames"("user_id");
