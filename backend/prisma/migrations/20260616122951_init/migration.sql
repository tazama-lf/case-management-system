/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `cms_usernames` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cms_usernames_user_id_key" ON "cms_usernames"("user_id");
