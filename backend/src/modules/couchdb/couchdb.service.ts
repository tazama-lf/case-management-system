import { BadRequestException, Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import nano from 'nano';

/**
 * Lifecycle of an evidence document. An upload creates it `pending` and only marks it `committed` once its Postgres
 * rows are written, so a half-finished upload is never shown. Documents written before this field existed have no
 * status and count as committed.
 */
export const EVIDENCE_STATUS = { PENDING: 'pending', COMMITTED: 'committed' } as const;

// A pending document older than this is an abandoned upload and is purged; far longer than any upload takes.
const PENDING_EVIDENCE_GRACE_MS = 30 * 60 * 1000;
const PENDING_EVIDENCE_PURGE_BATCH = 200;

export interface QueryDocumentsParams {
  id?: string;
  evidenceId?: string;
  reportId?: string;
  tenantId: string;
  uploadedBy?: string;
  taskId?: number;
  caseId?: number;
  caseIds?: number[];
  evidenceType?: string;
  verified?: boolean;
  archive?: boolean;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class CouchdbService implements OnModuleInit {
  private readonly logger = new Logger(CouchdbService.name);
  private readonly nanoInstance: nano.ServerScope;
  private db: nano.DocumentScope<any>;
  private readonly dbName: string;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('COUCHDB_URL');
    const username = this.configService.getOrThrow<string>('COUCHDB_USERNAME');
    const password = this.configService.getOrThrow<string>('COUCHDB_PASSWORD');
    this.dbName = this.configService.getOrThrow<string>('COUCHDB_DATABASE');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error('COUCHDB_URL is not a valid URL', { cause: error });
    }
    parsedUrl.username = encodeURIComponent(username);
    parsedUrl.password = encodeURIComponent(password);

    this.nanoInstance = nano(parsedUrl.toString());
  }

  async onModuleInit(): Promise<void> {
    try {
      const dbList = await this.nanoInstance.db.list();

      if (!dbList.includes(this.dbName)) {
        this.logger.log(`Creating database: ${this.dbName}`);
        await this.nanoInstance.db.create(this.dbName);
      }

      this.db = this.nanoInstance.use(this.dbName);
      this.logger.log(`Connected to CouchDB database: ${this.dbName}`);

      await this.ensureEvidenceDesignDocument();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to initialize CouchDB: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  private async ensureEvidenceDesignDocument(): Promise<void> {
    const designId = '_design/evidence';
    try {
      await this.db.get(designId);
      return;
    } catch (error) {
      const { statusCode } = error as { statusCode?: number };
      if (statusCode !== 404) {
        throw error;
      }
    }

    this.logger.log(`Creating design document: ${designId}`);
    await this.db.insert(
      {
        views: {
          by_uploadedAt: {
            map: 'function (doc) { if (doc.uploadedAt && doc.archive !== true) { emit(doc.uploadedAt, null); } }',
          },
        },
      } as any,
      designId,
    );
  }

  getDatabase(): nano.DocumentScope<any> {
    return this.db;
  }

  async insertDocument(docId: string, metadata: any): Promise<nano.DocumentInsertResponse> {
    return await this.db.insert(metadata, docId);
  }

  async deleteEvidence(evidenceId: string, fileName: string, rev: string): Promise<nano.DocumentDestroyResponse> {
    try {
      await this.db.destroy(evidenceId, rev);
      this.logger.log(`Evidence document "${evidenceId}" deleted successfully`);

      return { ok: true, id: evidenceId, rev: '' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete document: ${errorMessage}`, errorStack, CouchdbService.name);
      throw new Error(errorMessage, { cause: error });
    }
  }

  async insertAttachment(
    docId: string,
    rev: string,
    name: string,
    data: Buffer,
    mime: string,
  ): Promise<{ ok: boolean; id: string; rev: string; filePath: string }> {
    const result = await this.db.attachment.insert(docId, name, new Uint8Array(data), mime, { rev });

    const attachmentUrl = `${this.db.config.url}/${this.db.config.db}/${docId}/${encodeURIComponent(name)}`;

    return {
      ok: result.ok,
      id: result.id,
      rev: result.rev,
      filePath: attachmentUrl,
    };
  }

  async getDocument(docId: string): Promise<any> {
    try {
      return await this.db.get(docId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get document: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  async queryDocuments(
    params: QueryDocumentsParams,
  ): Promise<{ data: any[]; page: number; limit: number; total: number; totalPages: number }> {
    const {
      id,
      evidenceId,
      reportId,
      tenantId,
      uploadedBy,
      taskId,
      caseId,
      caseIds,
      evidenceType,
      verified,
      archive,
      search,
      page,
      limit,
    } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    const selector: any = {};

    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new BadRequestException('tenantId is required');
    }

    if (id) selector.id = id;
    selector.tenantId = tenantId;
    if (uploadedBy) selector.uploadedBy = uploadedBy;
    if (taskId) selector.taskId = taskId;
    if (caseId) selector.caseId = caseId;
    if (caseIds) selector.caseId = { $in: caseIds };
    if (evidenceId) selector.evidenceId = evidenceId;
    if (reportId) selector.reportId = reportId;
    if (evidenceType) selector.evidenceType = evidenceType;
    if (archive !== undefined) selector.archive = archive;
    if (verified !== undefined) selector.verified = verified;

    if (search) {
      selector.$or = [{ fileName: { $regex: search } }, { description: { $regex: search } }, { comments: { $regex: search } }];

      if (search.length === 36) {
        selector.$or.push({ id: search });
        selector.$or.push({ taskId: search });
      }
    }

    try {
      const result = await this.db.find({
        selector,
        limit,
        skip: (page - 1) * limit,
      });

      const totalCountResult = await this.db.find({
        selector,
        limit: 0,
      });

      return {
        // Pending documents belong to an upload that has not finished (or died); no reader may see them.
        data: result.docs.filter((doc) => doc.status !== EVIDENCE_STATUS.PENDING),
        page,
        limit,
        total: totalCountResult.docs.length,
        totalPages: Math.ceil(totalCountResult.docs.length / limit),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to query documents: ${errorMessage}`, errorStack, CouchdbService.name);
      throw new InternalServerErrorException('Unable to fetch document list');
    }
  }

  async updateDocument(docId: string, data: any): Promise<nano.DocumentInsertResponse> {
    const existing = await this.db.get(docId);

    const updated = {
      ...existing,
      ...data,
      _attachments: existing._attachments,
      _rev: existing._rev,
    };

    return await this.db.insert(updated);
  }

  async getAttachment(docId: string, attachmentName: string): Promise<Buffer> {
    try {
      const attachment = await this.db.attachment.get(docId, attachmentName);
      return attachment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get attachment: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  async listDocuments(params?: nano.DocumentListParams): Promise<nano.DocumentListResponse<any>> {
    try {
      return await this.db.list(params ?? {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to list documents: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  async deleteDocument(docId: string, rev: string): Promise<nano.DocumentDestroyResponse> {
    try {
      return await this.db.destroy(docId, rev);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete document: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  async createIndex(fields: string[]): Promise<any> {
    try {
      return await this.db.createIndex({
        index: {
          fields,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create index: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoArchiveOldEvidence(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    try {
      const result = await this.db.view('evidence', 'by_uploadedAt', {
        endkey: cutoff,
        include_docs: true,
      });

      const candidates = result.rows.filter((row) => !row.doc.archive);

      const updatePromises = candidates.map(async (row) => {
        const { doc } = row;
        doc.archive = true;

        return await this.db.insert({
          ...doc,
          _id: doc._id,
          _rev: doc._rev,
        });
      });

      await Promise.all(updatePromises);

      this.logger.log(`Auto-archived ${candidates.length} evidence older than 7 days`, CouchdbService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to auto-archive evidence: ${errorMessage}`, errorStack, CouchdbService.name);
    }
  }

  /**
   * Removes evidence documents left `pending` by an upload that never finished (the process died between the CouchDB
   * and Postgres writes, or the cleanup after a failure also failed). Pending documents are invisible to every reader,
   * so this only reclaims space. Only documents older than the grace period are touched, so an upload still in
   * progress is never removed, and no Postgres lookup is needed.
   */
  @Cron('0 */15 * * * *')
  async purgeStalePendingEvidence(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_EVIDENCE_GRACE_MS).toISOString();

    try {
      const result = await this.db.find({
        selector: { status: EVIDENCE_STATUS.PENDING, uploadedAt: { $lt: cutoff } },
        limit: PENDING_EVIDENCE_PURGE_BATCH,
      });

      const results = await Promise.allSettled(result.docs.map(async (doc) => await this.db.destroy(doc._id, doc._rev)));

      let purged = 0;
      results.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          purged += 1;
          this.logger.warn(`Removed abandoned pending evidence document ${result.docs[index]._id}`, CouchdbService.name);
        } else {
          const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
          this.logger.error(
            `Failed to remove pending evidence document ${result.docs[index]._id}: ${reason}`,
            undefined,
            CouchdbService.name,
          );
        }
      });

      if (purged > 0) {
        this.logger.log(`Purged ${purged} abandoned pending evidence document(s)`, CouchdbService.name);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to purge pending evidence: ${errorMessage}`, errorStack, CouchdbService.name);
    }
  }
}
