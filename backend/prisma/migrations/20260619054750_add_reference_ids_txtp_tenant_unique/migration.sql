/*
  Warnings:

  - A unique constraint covering the columns `[txTp,tenant_id]` on the table `reference_ids` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "reference_ids_txTp_tenant_id_key" ON "reference_ids"("txTp", "tenant_id");
