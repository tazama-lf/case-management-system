import { BadRequestException, Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nano from 'nano';

@Injectable()
export class CouchdbService implements OnModuleInit {
  private readonly logger = new Logger(CouchdbService.name);
  private readonly nanoInstance: nano.ServerScope;
  private db: nano.DocumentScope<any>;
  private readonly dbName: string;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('COUCHDB_URL') ?? 'http://10.10.80.16:5984';
    const username = this.configService.get<string>('COUCHDB_USERNAME') ?? 'simon';
    const password = this.configService.get<string>('COUCHDB_PASSWORD') ?? '1234';
    this.dbName = this.configService.get<string>('COUCHDB_DATABASE') ?? 'cms-evidence';

    const urlWithAuth = url.replace('://', `://${username}:${password}@`);

    this.nanoInstance = nano(urlWithAuth);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to initialize CouchDB: ${errorMessage}`, errorStack, CouchdbService.name);
      throw error;
    }
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

  async queryDocuments(params: {
    id?: string;
    evidenceId?: string;
    reportId?: string;
    tenantId?: string;
    uploadedBy?: string;
    taskId?: number;
    caseId?: number;
    evidenceType?: string;
    verified?: boolean;
    archive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ data: any[]; page: number; limit: number; total: number; totalPages: number }> {
    const { id, evidenceId, reportId, tenantId, uploadedBy, taskId, caseId, evidenceType, verified, archive, search, page, limit } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    const selector: any = {};

    if (id) selector.id = id;
    if (tenantId) selector.tenantId = tenantId;
    if (uploadedBy) selector.uploadedBy = uploadedBy;
    if (taskId) selector.taskId = taskId;
    if (caseId) selector.caseId = caseId;
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
        data: result.docs,
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

      const updatePromises = result.rows
        .filter((row) => !row.doc.archiveFlag)
        .map(async (row) => {
          const { doc } = row;
          doc.archive = true;

          return await this.db.insert({
            ...doc,
            _id: doc._id,
            _rev: doc._rev,
          });
        });

      await Promise.all(updatePromises);

      this.logger.log(`Auto-archived ${result.rows.length} evidence older than 7 days`, CouchdbService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to auto-archive evidence: ${errorMessage}`, errorStack, CouchdbService.name);
    }
  }
}
