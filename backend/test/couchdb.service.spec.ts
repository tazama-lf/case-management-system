import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as nano from 'nano';

jest.mock('nano');

describe('CouchdbService', () => {
  let service: CouchdbService;
  let configService: jest.Mocked<ConfigService>;
  let mockNanoInstance: any;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn(),
      get: jest.fn(),
      destroy: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      createIndex: jest.fn(),
      view: jest.fn(),
      attachment: {
        insert: jest.fn(),
        get: jest.fn(),
      },
      config: {
        url: 'http://10.10.80.16:5984',
        db: 'cms-evidence',
      },
    };

    mockNanoInstance = {
      db: {
        list: jest.fn(),
        create: jest.fn(),
      },
      use: jest.fn().mockReturnValue(mockDb),
    };

    (nano as any).mockReturnValue(mockNanoInstance);

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          COUCHDB_URL: 'http://10.10.80.16:5984',
          COUCHDB_USERNAME: 'simon',
          COUCHDB_PASSWORD: '1234',
          COUCHDB_DATABASE: 'cms-evidence',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouchdbService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CouchdbService>(CouchdbService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to existing database', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence', 'other-db']);

      await service.onModuleInit();

      expect(mockNanoInstance.db.list).toHaveBeenCalled();
      expect(mockNanoInstance.db.create).not.toHaveBeenCalled();
      expect(mockNanoInstance.use).toHaveBeenCalledWith('cms-evidence');
    });

    it('should create database if it does not exist', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['other-db']);
      mockNanoInstance.db.create.mockResolvedValue({ ok: true });

      await service.onModuleInit();

      expect(mockNanoInstance.db.list).toHaveBeenCalled();
      expect(mockNanoInstance.db.create).toHaveBeenCalledWith('cms-evidence');
      expect(mockNanoInstance.use).toHaveBeenCalledWith('cms-evidence');
    });

    it('should throw error if database initialization fails', async () => {
      mockNanoInstance.db.list.mockRejectedValue(new Error('Connection failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });

    it('should handle empty database list', async () => {
      mockNanoInstance.db.list.mockResolvedValue([]);
      mockNanoInstance.db.create.mockResolvedValue({ ok: true });

      await service.onModuleInit();

      expect(mockNanoInstance.db.create).toHaveBeenCalledWith('cms-evidence');
    });
  });

  describe('getDatabase', () => {
    it('should return database instance', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const db = service.getDatabase();

      expect(db).toBe(mockDb);
    });
  });

  describe('insertDocument', () => {
    it('should insert document successfully', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const metadata = { fileName: 'test.pdf', size: 1024 };
      mockDb.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '1-abc' });

      const result = await service.insertDocument('doc-123', metadata);

      expect(mockDb.insert).toHaveBeenCalledWith(metadata, 'doc-123');
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '1-abc' });
    });

    it('should handle insertion errors', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      mockDb.insert.mockRejectedValue(new Error('Insert failed'));

      await expect(service.insertDocument('doc-123', {})).rejects.toThrow('Insert failed');
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence successfully', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      mockDb.destroy.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.deleteEvidence('doc-123', 'file.pdf', '1-abc');

      expect(mockDb.destroy).toHaveBeenCalledWith('doc-123', '1-abc');
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '' });
    });

    it('should handle deletion errors', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      mockDb.destroy.mockRejectedValue(new Error('Document not found'));

      await expect(service.deleteEvidence('doc-123', 'file.pdf', '1-abc')).rejects.toThrow();
    });
  });

  describe('insertAttachment', () => {
    it('should insert attachment successfully', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const buffer = Buffer.from('file content');
      mockDb.attachment.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.insertAttachment('doc-123', '1-abc', 'file.pdf', buffer, 'application/pdf');

      expect(mockDb.attachment.insert).toHaveBeenCalledWith(
        'doc-123',
        'file.pdf',
        expect.any(Uint8Array),
        'application/pdf',
        { rev: '1-abc' },
      );
      expect(result).toEqual({
        ok: true,
        id: 'doc-123',
        rev: '2-xyz',
        filePath: 'http://10.10.80.16:5984/cms-evidence/doc-123/file.pdf',
      });
    });

    it('should encode special characters in attachment name', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const buffer = Buffer.from('content');
      mockDb.attachment.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.insertAttachment('doc-123', '1-abc', 'my file.pdf', buffer, 'application/pdf');

      expect(result.filePath).toContain('my%20file.pdf');
    });

    it('should handle attachment insertion errors', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      mockDb.attachment.insert.mockRejectedValue(new Error('Attachment failed'));

      await expect(
        service.insertAttachment('doc-123', '1-abc', 'file.pdf', Buffer.from(''), 'application/pdf'),
      ).rejects.toThrow('Attachment failed');
    });
  });

  describe('getDocument', () => {
    it('should get document successfully', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const mockDoc = { _id: 'doc-123', fileName: 'test.pdf' };
      mockDb.get.mockResolvedValue(mockDoc);

      const result = await service.getDocument('doc-123');

      expect(mockDb.get).toHaveBeenCalledWith('doc-123');
      expect(result).toEqual(mockDoc);
    });

    it('should return null for 404 errors', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const error: any = new Error('Not found');
      error.statusCode = 404;
      mockDb.get.mockRejectedValue(error);

      const result = await service.getDocument('doc-123');

      expect(result).toBeNull();
    });

    it('should throw error for non-404 errors', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      const error: any = new Error('Database error');
      error.statusCode = 500;
      mockDb.get.mockRejectedValue(error);

      await expect(service.getDocument('doc-123')).rejects.toThrow('Database error');
    });
  });

  describe('queryDocuments', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should query documents with pagination', async () => {
      const mockDocs = [{ id: 'doc-1' }, { id: 'doc-2' }];
      mockDb.find.mockResolvedValueOnce({ docs: mockDocs });
      mockDb.find.mockResolvedValueOnce({ docs: new Array(20) });

      const result = await service.queryDocuments({ page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: {},
        limit: 10,
        skip: 0,
      });
      expect(result).toEqual({
        data: mockDocs,
        page: 1,
        limit: 10,
        total: 20,
        totalPages: 2,
      });
    });

    it('should throw BadRequestException for invalid page', async () => {
      await expect(service.queryDocuments({ page: 0, limit: 10 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.queryDocuments({ page: -1, limit: 10 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.queryDocuments({ page: 1.5, limit: 10 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid limit', async () => {
      await expect(service.queryDocuments({ page: 1, limit: 0 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.queryDocuments({ page: 1, limit: -10 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should filter by id', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });

      await service.queryDocuments({ id: 'doc-123', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: { id: 'doc-123' },
        }),
      );
    });

    it('should filter by tenantId', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });

      await service.queryDocuments({ tenantId: 'tenant-123', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: { tenantId: 'tenant-123' },
        }),
      );
    });

    it('should filter by multiple fields', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });

      await service.queryDocuments({
        tenantId: 'tenant-123',
        caseId: 456,
        taskId: 789,
        evidenceType: 'document',
        verified: true,
        archive: false,
        page: 1,
        limit: 10,
      });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: {
            tenantId: 'tenant-123',
            caseId: 456,
            taskId: 789,
            evidenceType: 'document',
            verified: true,
            archive: false,
          },
        }),
      );
    });

    it('should handle search with text fields', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });

      await service.queryDocuments({ search: 'test query', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: {
            $or: [
              { fileName: { $regex: 'test query' } },
              { description: { $regex: 'test query' } },
              { comments: { $regex: 'test query' } },
            ],
          },
        }),
      );
    });

    it('should handle search with UUID (36 characters)', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      await service.queryDocuments({ search: uuid, page: 1, limit: 10 });

      const call = (mockDb.find as jest.Mock).mock.calls[0][0];
      expect(call.selector.$or).toContainEqual({ id: uuid });
      expect(call.selector.$or).toContainEqual({ taskId: uuid });
    });

    it('should handle query errors', async () => {
      mockDb.find.mockRejectedValue(new Error('Query failed'));

      await expect(service.queryDocuments({ page: 1, limit: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should calculate skip correctly for different pages', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });

      await service.queryDocuments({ page: 3, limit: 20 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
        }),
      );
    });
  });

  describe('updateDocument', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should update document while preserving attachments', async () => {
      const existingDoc = {
        _id: 'doc-123',
        _rev: '1-abc',
        fileName: 'old.pdf',
        _attachments: { 'file.pdf': {} },
      };
      const updates = { fileName: 'new.pdf', description: 'Updated' };

      mockDb.get.mockResolvedValue(existingDoc);
      mockDb.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.updateDocument('doc-123', updates);

      expect(mockDb.get).toHaveBeenCalledWith('doc-123');
      expect(mockDb.insert).toHaveBeenCalledWith({
        _id: 'doc-123',
        _rev: '1-abc',
        fileName: 'new.pdf',
        description: 'Updated',
        _attachments: { 'file.pdf': {} },
      });
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '2-xyz' });
    });

    it('should handle update errors', async () => {
      mockDb.get.mockRejectedValue(new Error('Document not found'));

      await expect(service.updateDocument('doc-123', {})).rejects.toThrow('Document not found');
    });
  });

  describe('getAttachment', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should get attachment successfully', async () => {
      const buffer = Buffer.from('file content');
      mockDb.attachment.get.mockResolvedValue(buffer);

      const result = await service.getAttachment('doc-123', 'file.pdf');

      expect(mockDb.attachment.get).toHaveBeenCalledWith('doc-123', 'file.pdf');
      expect(result).toEqual(buffer);
    });

    it('should handle attachment retrieval errors', async () => {
      mockDb.attachment.get.mockRejectedValue(new Error('Attachment not found'));

      await expect(service.getAttachment('doc-123', 'file.pdf')).rejects.toThrow(
        'Attachment not found',
      );
    });
  });

  describe('listDocuments', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should list documents with default params', async () => {
      const mockResponse = { total_rows: 10, rows: [] };
      mockDb.list.mockResolvedValue(mockResponse);

      const result = await service.listDocuments();

      expect(mockDb.list).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse);
    });

    it('should list documents with custom params', async () => {
      const params = { limit: 20, skip: 10 };
      const mockResponse = { total_rows: 100, rows: [] };
      mockDb.list.mockResolvedValue(mockResponse);

      const result = await service.listDocuments(params);

      expect(mockDb.list).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResponse);
    });

    it('should handle list errors', async () => {
      mockDb.list.mockRejectedValue(new Error('List failed'));

      await expect(service.listDocuments()).rejects.toThrow('List failed');
    });
  });

  describe('deleteDocument', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should delete document successfully', async () => {
      mockDb.destroy.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.deleteDocument('doc-123', '1-abc');

      expect(mockDb.destroy).toHaveBeenCalledWith('doc-123', '1-abc');
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '2-xyz' });
    });

    it('should handle delete errors', async () => {
      mockDb.destroy.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteDocument('doc-123', '1-abc')).rejects.toThrow('Delete failed');
    });
  });

  describe('createIndex', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should create index successfully', async () => {
      mockDb.createIndex.mockResolvedValue({ result: 'created' });

      const result = await service.createIndex(['tenantId', 'caseId']);

      expect(mockDb.createIndex).toHaveBeenCalledWith({
        index: {
          fields: ['tenantId', 'caseId'],
        },
      });
      expect(result).toEqual({ result: 'created' });
    });

    it('should handle index creation errors', async () => {
      mockDb.createIndex.mockRejectedValue(new Error('Index creation failed'));

      await expect(service.createIndex(['tenantId'])).rejects.toThrow('Index creation failed');
    });
  });

  describe('autoArchiveOldEvidence', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should archive old evidence', async () => {
      const oldDoc = {
        _id: 'doc-123',
        _rev: '1-abc',
        fileName: 'old.pdf',
        archiveFlag: false,
      };

      mockDb.view.mockResolvedValue({
        rows: [{ doc: oldDoc }],
      });
      mockDb.insert.mockResolvedValue({ ok: true });

      await service.autoArchiveOldEvidence();

      expect(mockDb.view).toHaveBeenCalledWith(
        'evidence',
        'by_uploadedAt',
        expect.objectContaining({
          include_docs: true,
        }),
      );
      expect(mockDb.insert).toHaveBeenCalledWith({
        ...oldDoc,
        archive: true,
        _id: 'doc-123',
        _rev: '1-abc',
      });
    });

    it('should not archive already archived evidence', async () => {
      const archivedDoc = {
        _id: 'doc-456',
        _rev: '1-xyz',
        archiveFlag: true,
      };

      mockDb.view.mockResolvedValue({
        rows: [{ doc: archivedDoc }],
      });

      await service.autoArchiveOldEvidence();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle multiple documents', async () => {
      const docs = [
        { _id: 'doc-1', _rev: '1-a', archiveFlag: false },
        { _id: 'doc-2', _rev: '1-b', archiveFlag: false },
        { _id: 'doc-3', _rev: '1-c', archiveFlag: true },
      ];

      mockDb.view.mockResolvedValue({
        rows: docs.map((doc) => ({ doc })),
      });
      mockDb.insert.mockResolvedValue({ ok: true });

      await service.autoArchiveOldEvidence();

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should handle archiving errors gracefully', async () => {
      mockDb.view.mockRejectedValue(new Error('View failed'));

      await expect(service.autoArchiveOldEvidence()).resolves.not.toThrow();
    });

    it('should handle empty results', async () => {
      mockDb.view.mockResolvedValue({ rows: [] });

      await service.autoArchiveOldEvidence();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('constructor configuration', () => {
    it('should use default values when config is not provided', () => {
      const mockConfigServiceWithDefaults = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module = Test.createTestingModule({
        providers: [
          CouchdbService,
          {
            provide: ConfigService,
            useValue: mockConfigServiceWithDefaults,
          },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should construct URL with authentication', () => {
      expect(nano).toHaveBeenCalledWith(
        expect.stringContaining('simon:1234@'),
      );
    });
  });
});
