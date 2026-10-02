/*
  Adds dedicated, indexed columns for the ISO20022 identifiers manual case
  creation needs to search on (MsgId, OrgnlEndToEndId, OrgnlInstrId, debtor/
  creditor account id), and backfills them from the existing `transaction`
  Json blob for every already-ingested alert. Nullable, additive, no data
  loss: this only adds columns and populates them, it never rewrites or
  drops `transaction`/`alert_data`/`network_map`.

  Field paths below cover every ISO20022 message shape currently ingested
  (see @tazama-lf/frms-coe-lib interfaces):
    - pacs.002.001.12 (payment status report): FIToFIPmtSts.GrpHdr.MsgId,
      FIToFIPmtSts.TxInfAndSts.{OrgnlEndToEndId,OrgnlInstrId}
    - pacs.008.001.10 (credit transfer): FIToFICstmrCdtTrf.GrpHdr.MsgId,
      FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.{EndToEndId,InstrId}
    - pain.001.001.11 (customer credit transfer initiation):
      CstmrCdtTrfInitn.GrpHdr.MsgId,
      CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId
    - pain.013.001.09 (creditor payment activation request):
      CdtrPmtActvtnReq.GrpHdr.MsgId,
      CdtrPmtActvtnReq.PmtInf.CdtTrfTxInf.PmtId.EndToEndId

  Debtor/creditor account ids come from the rule/typology engine's DataCache
  enrichment object (see @tazama-lf/frms-coe-lib's DataCache interface):
    DataCache.dbtrAcctId, DataCache.cdtrAcctId
  These are flat strings populated for every message type, including pacs.002
  (which carries no Dbtr/Cdtr party data of its own), and match what
  extractTransactionIdentifiers reads at ingest time.

  pacs.008/pain.001/pain.013 don't carry an "Orgnl"-prefixed end-to-end/
  instruction id (that prefix only exists on the pacs.002 status report that
  references an earlier message) - their plain EndToEndId/InstrId are the
  same identifier concept, so they're folded into the same
  orgnl_end_to_end_id/orgnl_instr_id columns as a fallback.
*/

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN "msg_id" VARCHAR(140);
ALTER TABLE "alerts" ADD COLUMN "orgnl_end_to_end_id" VARCHAR(140);
ALTER TABLE "alerts" ADD COLUMN "orgnl_instr_id" VARCHAR(140);
ALTER TABLE "alerts" ADD COLUMN "dbtr_acct_id" VARCHAR(140);
ALTER TABLE "alerts" ADD COLUMN "cdtr_acct_id" VARCHAR(140);

-- Backfill from the existing transaction Json blob
UPDATE "alerts" SET
  "msg_id" = COALESCE(
    transaction #>> '{FIToFIPmtSts,GrpHdr,MsgId}',
    transaction #>> '{FIToFICstmrCdtTrf,GrpHdr,MsgId}',
    transaction #>> '{CstmrCdtTrfInitn,GrpHdr,MsgId}',
    transaction #>> '{CdtrPmtActvtnReq,GrpHdr,MsgId}'
  ),
  "orgnl_end_to_end_id" = COALESCE(
    transaction #>> '{FIToFIPmtSts,TxInfAndSts,OrgnlEndToEndId}',
    transaction #>> '{FIToFICstmrCdtTrf,CdtTrfTxInf,PmtId,EndToEndId}',
    transaction #>> '{CstmrCdtTrfInitn,PmtInf,CdtTrfTxInf,PmtId,EndToEndId}',
    transaction #>> '{CdtrPmtActvtnReq,PmtInf,CdtTrfTxInf,PmtId,EndToEndId}'
  ),
  "orgnl_instr_id" = COALESCE(
    transaction #>> '{FIToFIPmtSts,TxInfAndSts,OrgnlInstrId}',
    transaction #>> '{FIToFICstmrCdtTrf,CdtTrfTxInf,PmtId,InstrId}'
  ),
  "dbtr_acct_id" = transaction #>> '{DataCache,dbtrAcctId}',
  "cdtr_acct_id" = transaction #>> '{DataCache,cdtrAcctId}'
WHERE transaction IS NOT NULL;

-- CreateIndex
CREATE INDEX "alerts_msg_id_idx" ON "alerts"("msg_id");
CREATE INDEX "alerts_orgnl_end_to_end_id_idx" ON "alerts"("orgnl_end_to_end_id");
CREATE INDEX "alerts_orgnl_instr_id_idx" ON "alerts"("orgnl_instr_id");
CREATE INDEX "alerts_dbtr_acct_id_idx" ON "alerts"("dbtr_acct_id");
CREATE INDEX "alerts_cdtr_acct_id_idx" ON "alerts"("cdtr_acct_id");
