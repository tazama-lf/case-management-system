import { BadRequestException, Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nano from 'nano';

@Injectable()
export class CouchdbService implements OnModuleInit {
  private readonly logger = new Logger(CouchdbService.name);
  private nanoInstance: nano.ServerScope;
  private db: nano.DocumentScope<any>;
  private readonly dbName: string;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('COUCHDB_URL', 'http://localhost:5984');
    const username = this.configService.get<string>('COUCHDB_USERNAME', 'simon');
    const password = this.configService.get<string>('COUCHDB_PASSWORD', '1234');
    this.dbName = this.configService.get<string>('COUCHDB_DATABASE', 'evidence_store');

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

  // CouchdbService method
  async insertWithAttachment(docId: string, metadata: any, attachmentName: string, attachmentData: Buffer, contentType: string) {
    try {
      // Insert document metadata
      const response = await this.db.insert(metadata, docId);

      // Store attachment as Uint8Array
      await this.db.attachment.insert(docId, attachmentName, new Uint8Array(attachmentData), contentType, { rev: response.rev });

      this.logger.log(`Document inserted with attachment: ${docId}`);

      // Verify attachment length
      // const downloaded = await this.db.attachment.get(docId, attachmentName);
      // const downloadedBuffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded);
      // if (downloadedBuffer.length !== attachmentData.length) {
      //   this.logger.error(`Attachment size mismatch: original=${attachmentData.length}, stored=${downloadedBuffer.length}`);
      //   throw new Error('Attachment verification failed: size mismatch');
      // }

      return `${this.db.config.url}/${this.db.config.db}/${docId}/${encodeURIComponent(metadata.fileName)}`;
    } catch (error) {
      this.logger.error(`Failed to insert document with attachment: ${error.message}`, error.stack);
      throw error;
    }
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
    search?: string;
    page: number;
    limit: number;
  }) {
    const { id, evidenceId, tenantId, uploadedBy, taskId, evidenceType, verified, search, page, limit } = params;

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
}
