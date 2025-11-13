import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

    // Construct URL with authentication
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

  async insertWithAttachment(
    docId: string,
    metadata: any,
    attachmentName: string,
    attachmentData: Buffer,
    contentType: string,
  ): Promise<nano.DocumentInsertResponse> {
    try {
      const response = await this.db.insert(metadata, docId);

      await this.db.attachment.insert(docId, attachmentName, attachmentData, contentType, { rev: response.rev });

      this.logger.log(`Document inserted with attachment: ${docId}`);
      return response;
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

  async queryByCaseId(caseId: string): Promise<any[]> {
    try {
      const result = await this.db.find({
        selector: {
          caseId: caseId,
        },
        limit: 1000,
      });

      return result.docs;
    } catch (error) {
      this.logger.error(`Failed to query by case ID: ${error.message}`, error.stack);
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
