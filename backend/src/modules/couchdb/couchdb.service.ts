import { BadRequestException, Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nano from 'nano';

@Injectable()
export class CouchdbService implements OnModuleInit {
  private readonly logger = new Logger(CouchdbService.name);
  private nanoInstance: nano.ServerScope;
  private db: nano.DocumentScope<any>;
  private readonly dbName: string;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('COUCHDB_URL') || 'http://localhost:5984';
    const username = this.configService.get<string>('COUCHDB_USERNAME');
    const password = this.configService.get<string>('COUCHDB_PASSWORD');
    this.dbName = this.configService.get<string>('COUCHDB_DATABASE') || 'evidence_store';

    const urlWithAuth = url.replace('://', `://${username}:${password}@`);

    this.nanoInstance = nano(urlWithAuth);
  }

  async onModuleInit() {
    try {
      const dbList = await this.nanoInstance.db.list();

      if (!dbList.includes(this.dbName)) {
        this.logger.log(`Creating database: ${this.dbName}`);
        await this.nanoInstance.db.create(this.dbName);
      }

      this.db = this.nanoInstance.use(this.dbName);
      this.logger.log(`Connected to CouchDB database: ${this.dbName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize CouchDB: ${error.message}`, error.stack);
      throw error;
    }
  }

  getDatabase(): nano.DocumentScope<any> {
    return this.db;
  }

  async insertDocument(docId: string, metadata: any) {
    return this.db.insert(metadata, docId);
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
      if (error.statusCode === 404) {
        return null;
      }
      this.logger.error(`Failed to get document: ${error.message}`, error.stack);
      throw error;
    }
  }

  async queryDocuments(params: {
    id?: string;
    evidenceId?: string;
    tenantId?: string;
    uploadedBy?: string;
    taskId?: string;
    evidenceType?: string;
    verified?: boolean;
    archive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { id, evidenceId, tenantId, uploadedBy, taskId, evidenceType, verified, archive, search, page, limit } = params;

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
    if (evidenceId) selector.evidenceId = evidenceId;
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
      this.logger.error(`Failed to query documents: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Unable to fetch document list');
    }
  }

  async updateDocument(docId: string, data: any) {
    const existing = await this.db.get(docId);

    const updated = {
      ...existing,
      ...data,
      _attachments: existing._attachments,
      _rev: existing._rev,
    };

    return this.db.insert(updated);
  }

  async getAttachment(docId: string, attachmentName: string): Promise<Buffer> {
    try {
      const attachment = await this.db.attachment.get(docId, attachmentName);
      return attachment as Buffer;
    } catch (error) {
      this.logger.error(`Failed to get attachment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async listDocuments(params?: nano.DocumentListParams): Promise<nano.DocumentListResponse<any>> {
    try {
      return await this.db.list(params || {});
    } catch (error) {
      this.logger.error(`Failed to list documents: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteDocument(docId: string, rev: string): Promise<nano.DocumentDestroyResponse> {
    try {
      return await this.db.destroy(docId, rev);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createIndex(fields: string[]): Promise<any> {
    try {
      return await this.db.createIndex({
        index: {
          fields: fields,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create index: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoArchiveOldEvidence() {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    try {
      const result = await this.db.view('evidence', 'by_uploadedAt', {
        endkey: cutoff,
        include_docs: true,
      });

      for (const row of result.rows) {
        const doc = row.doc;

        if (!doc.archiveFlag) {
          doc.archive = true;

          await this.db.insert({
            ...doc,
            _id: doc._id,
            _rev: doc._rev,
          });
        }
      }

      this.logger.log(`Auto-archived ${result.rows.length} evidence older than 7 days`);
    } catch (error) {
      this.logger.error(`Failed to auto-archive evidence: ${error.message}`, error.stack);
    }
  }
}
