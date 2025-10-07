/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `status` to the `alerts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."alerts" DROP CONSTRAINT "alerts_case_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tasks" DROP CONSTRAINT "tasks_assigned_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."alerts" ADD COLUMN     "status" VARCHAR(10) NOT NULL,
ALTER COLUMN "case_id" DROP NOT NULL;

-- DropTable
DROP TABLE "public"."User";

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("case_id") ON DELETE SET NULL ON UPDATE CASCADE;
