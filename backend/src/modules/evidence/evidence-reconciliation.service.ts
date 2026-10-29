import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CouchdbService, EVIDENCE_STATUS } from '../couchdb/couchdb.service';
import { EvidenceRepository } from '../repository/evidence.repository';

// An upload that has committed to Postgres but whose last step (marking the CouchDB document committed) was missed has
// a Postgres row; promote it once it is this old. One that is still running has no row yet, so it is left alone.
const PROMOTE_AFTER_MS = 2 * 60 * 1000;
// A pending document with no Postgres row is only treated as abandoned after this long, far more than any upload takes.
const ABANDON_AFTER_MS = 30 * 60 * 1000;
const BATCH_SIZE = 200;

type Outcome = 'promoted' | 'removed' | 'skipped';

/**
 * Settles evidence documents an upload left `pending` in CouchDB, by asking Postgres whether the upload committed:
 * a row exists, so the upload finished and the document is promoted to `committed`; no row exists and the document is
 * old enough, so the upload was abandoned and the document is removed. Postgres is the source of truth, so a finished
 * upload is never deleted.
 */
@Injectable()
export class EvidenceReconciliationService {
  private readonly logger = new Logger(EvidenceReconciliationService.name);

  constructor(
    private readonly couchdb: CouchdbService,
    private readonly evidenceRepository: EvidenceRepository,
  ) {}

  @Cron('0 */15 * * * *')
  async reconcilePendingEvidence(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - PROMOTE_AFTER_MS).toISOString();
      const documents = await this.couchdb.findPendingEvidenceOlderThan(cutoff, BATCH_SIZE);

      const results = await Promise.allSettled(documents.map(async (doc) => await this.reconcileOne(doc)));

      const tally: Record<Outcome, number> = { promoted: 0, removed: 0, skipped: 0 };
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          tally[result.value] += 1;
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          this.logger.error(`Failed to reconcile pending evidence document ${documents[index]._id}: ${reason}`);
        }
      });

      if (tally.promoted > 0 || tally.removed > 0) {
        this.logger.log(
          `Reconciled pending evidence: ${tally.promoted} promoted, ${tally.removed} removed, ${tally.skipped} left for later`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to reconcile pending evidence: ${errorMessage}`, errorStack);
    }
  }

  private async reconcileOne(doc: any): Promise<Outcome> {
    const evidenceId: string = doc._id;

    if (await this.evidenceRepository.evidenceExists(evidenceId)) {
      await this.couchdb.updateDocument(evidenceId, { status: EVIDENCE_STATUS.COMMITTED });
      this.logger.warn(`Promoted evidence document ${evidenceId}: its upload committed but the document was left pending`);
      return 'promoted';
    }

    const ageMs = Date.now() - new Date(doc.uploadedAt).getTime();
    if (ageMs < ABANDON_AFTER_MS) {
      return 'skipped';
    }

    await this.couchdb.deleteDocument(evidenceId, doc._rev);
    this.logger.warn(
      `Removed abandoned pending evidence document ${evidenceId}: no Postgres row after ${Math.round(ageMs / 60000)} minutes`,
    );
    return 'removed';
  }
}
