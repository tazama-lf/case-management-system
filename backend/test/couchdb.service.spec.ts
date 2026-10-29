import { Test, TestingModule } from '@nestjs/testing';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as nano from 'nano';

jest.mock('nano');

// Unfinished (pending) uploads are excluded in the selector itself. On CouchDB, $nor / $not / a bare $ne would also
// drop documents that have no status field (everything uploaded before it existed), hence the $exists:false branch.
const NOT_PENDING = { $and: [{ $or: [{ status: { $exists: false } }, { status: { $ne: 'pending' } }] }] };

describe('CouchdbService', () => {
  let service: CouchdbService;
  let configService: jest.Mocked<ConfigService>;
  let mockNanoInstance: any;
  let mockDb: any;

  const createMockConfig = (overrides: Record<string, string | undefined> = {}) => {
    const config: Record<string, string | undefined> = {
      COUCHDB_URL: 'http://10.10.80.16:5984',
      COUCHDB_USERNAME: 'simon',
      COUCHDB_PASSWORD: '1234',
      COUCHDB_DATABASE: 'cms-evidence',
      ...overrides,
    };

    return {
      get: jest.fn((key: string) => config[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = config[key];
        if (value === undefined) {
          throw new Error(`Configuration key "${key}" does not exist`);
        }
        return value;
      }),
    };
  };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouchdbService,
        {
          provide: ConfigService,
          useValue: createMockConfig(),
        },
      ],
    }).compile();

    service = module.get<CouchdbService>(CouchdbService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should construct URL with authentication', () => {
      expect(nano).toHaveBeenCalledWith(expect.stringContaining('simon:1234@'));
    });

    it.each(['COUCHDB_URL', 'COUCHDB_USERNAME', 'COUCHDB_PASSWORD', 'COUCHDB_DATABASE'])(
      'should fail to construct when %s is missing instead of falling back to a default',
      async (missingKey) => {
        await expect(
          Test.createTestingModule({
            providers: [CouchdbService, { provide: ConfigService, useValue: createMockConfig({ [missingKey]: undefined }) }],
          }).compile(),
        ).rejects.toThrow(`Configuration key "${missingKey}" does not exist`);
      },
    );

    it('should fail to construct when COUCHDB_URL is not a valid URL', async () => {
      await expect(
        Test.createTestingModule({
          providers: [CouchdbService, { provide: ConfigService, useValue: createMockConfig({ COUCHDB_URL: 'not-a-url' }) }],
        }).compile(),
      ).rejects.toThrow('COUCHDB_URL is not a valid URL');
    });

    it('should percent-encode credentials containing URL-special characters', async () => {
      (nano as any).mockClear();

      await Test.createTestingModule({
        providers: [
          CouchdbService,
          { provide: ConfigService, useValue: createMockConfig({ COUCHDB_PASSWORD: 'p@ss:word/1' }) },
        ],
      }).compile();

      expect(nano).toHaveBeenCalledWith(expect.stringContaining('simon:p%40ss%3Aword%2F1@'));
    });
  });

  describe('onModuleInit', () => {
    it('should connect to existing database', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence', 'other-db']);

      await service.onModuleInit();

      expect(mockNanoInstance.db.list).toHaveBeenCalled();
      expect(mockNanoInstance.db.create).not.toHaveBeenCalled();
      expect(mockNanoInstance.use).toHaveBeenCalledWith('cms-evidence');
    });

    it('should create database when not in list', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['other-db']);
      mockNanoInstance.db.create.mockResolvedValue({ ok: true });

      await service.onModuleInit();

      expect(mockNanoInstance.db.create).toHaveBeenCalledWith('cms-evidence');
      expect(mockNanoInstance.use).toHaveBeenCalledWith('cms-evidence');
    });

    it('should create database when list is empty', async () => {
      mockNanoInstance.db.list.mockResolvedValue([]);
      mockNanoInstance.db.create.mockResolvedValue({ ok: true });

      await service.onModuleInit();

      expect(mockNanoInstance.db.create).toHaveBeenCalledWith('cms-evidence');
      expect(mockNanoInstance.use).toHaveBeenCalledWith('cms-evidence');
    });

    it('creates the status + uploadedAt index the purge job relies on', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      mockDb.createIndex.mockResolvedValue({ result: 'created' });

      await service.onModuleInit();

      expect(mockDb.createIndex).toHaveBeenCalledWith({
        index: { fields: ['status', 'uploadedAt'] },
        ddoc: 'pending-evidence-by-status-uploadedat',
        name: 'pending-evidence-by-status-uploadedat',
      });
    });

    it('still starts when the index cannot be created, since the purge works without it', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      mockDb.createIndex.mockRejectedValue(new Error('index failed'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('should throw error if database initialization fails', async () => {
      mockNanoInstance.db.list.mockRejectedValue(new Error('Connection failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('getDatabase', () => {
    it('should return database instance', async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();

      expect(service.getDatabase()).toBe(mockDb);
    });
  });

  describe('insertDocument', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should insert document successfully', async () => {
      const metadata = { fileName: 'test.pdf', size: 1024 };
      mockDb.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '1-abc' });

      const result = await service.insertDocument('doc-123', metadata);

      expect(mockDb.insert).toHaveBeenCalledWith(metadata, 'doc-123');
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '1-abc' });
    });

    it('should handle insertion errors', async () => {
      mockDb.insert.mockRejectedValue(new Error('Insert failed'));

      await expect(service.insertDocument('doc-123', {})).rejects.toThrow('Insert failed');
    });
  });

  describe('deleteEvidence', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should delete evidence successfully', async () => {
      mockDb.destroy.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.deleteEvidence('doc-123', 'file.pdf', '1-abc');

      expect(mockDb.destroy).toHaveBeenCalledWith('doc-123', '1-abc');
      expect(result).toEqual({ ok: true, id: 'doc-123', rev: '' });
    });

    it('should handle deletion errors', async () => {
      mockDb.destroy.mockRejectedValue(new Error('Document not found'));

      await expect(service.deleteEvidence('doc-123', 'file.pdf', '1-abc')).rejects.toThrow();
    });
  });

  describe('insertAttachment', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should insert attachment successfully', async () => {
      const buffer = Buffer.from('file content');
      mockDb.attachment.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.insertAttachment('doc-123', '1-abc', 'file.pdf', buffer, 'application/pdf');

      expect(mockDb.attachment.insert).toHaveBeenCalledWith('doc-123', 'file.pdf', expect.any(Uint8Array), 'application/pdf', {
        rev: '1-abc',
      });
      expect(result).toEqual({
        ok: true,
        id: 'doc-123',
        rev: '2-xyz',
        filePath: 'http://10.10.80.16:5984/cms-evidence/doc-123/file.pdf',
      });
    });

    it('should encode special characters in attachment name', async () => {
      mockDb.attachment.insert.mockResolvedValue({ ok: true, id: 'doc-123', rev: '2-xyz' });

      const result = await service.insertAttachment('doc-123', '1-abc', 'my file.pdf', Buffer.from(''), 'application/pdf');

      expect(result.filePath).toContain('my%20file.pdf');
    });

    it('should handle attachment insertion errors', async () => {
      mockDb.attachment.insert.mockRejectedValue(new Error('Attachment failed'));

      await expect(service.insertAttachment('doc-123', '1-abc', 'file.pdf', Buffer.from(''), 'application/pdf')).rejects.toThrow(
        'Attachment failed',
      );
    });
  });

  describe('getDocument', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it('should get document successfully', async () => {
      const mockDoc = { _id: 'doc-123', fileName: 'test.pdf' };
      mockDb.get.mockResolvedValue(mockDoc);

      const result = await service.getDocument('doc-123');

      expect(mockDb.get).toHaveBeenCalledWith('doc-123');
      expect(result).toEqual(mockDoc);
    });

    it.each([
      ['404 errors', 404],
      ['non-404 errors', 500],
    ])('should throw error for %s', async (_description, statusCode) => {
      const error: any = new Error('Database error');
      error.statusCode = statusCode;
      mockDb.get.mockRejectedValue(error);

      await expect(service.getDocument('doc-123')).rejects.toThrow('Database error');
    });
  });

  describe('queryDocuments', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
      mockDb.find.mockResolvedValue({ docs: [] });
    });

    it('should query documents with pagination', async () => {
      const mockDocs = [{ id: 'doc-1' }, { id: 'doc-2' }];
      mockDb.find.mockResolvedValueOnce({ docs: mockDocs });
      mockDb.find.mockResolvedValueOnce({ docs: new Array(20) });

      const result = await service.queryDocuments({ tenantId: 'tenant-123', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith({
        selector: { tenantId: 'tenant-123', ...NOT_PENDING },
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

    it.each([
      ['invalid page', { page: 0, limit: 10 }],
      ['negative page', { page: -1, limit: 10 }],
      ['decimal page', { page: 1.5, limit: 10 }],
      ['invalid limit', { page: 1, limit: 0 }],
      ['negative limit', { page: 1, limit: -10 }],
    ])('should throw BadRequestException for %s', async (_description, params) => {
      await expect(service.queryDocuments(params as any)).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['id', { id: 'doc-123' }, { tenantId: 'tenant-123', id: 'doc-123' }],
      ['taskId', { taskId: 789 }, { tenantId: 'tenant-123', taskId: 789 }],
      ['caseId', { caseId: 456 }, { tenantId: 'tenant-123', caseId: 456 }],
      ['evidenceId', { evidenceId: 'ev-123' }, { tenantId: 'tenant-123', evidenceId: 'ev-123' }],
      ['reportId', { reportId: 'rep-123' }, { tenantId: 'tenant-123', reportId: 'rep-123' }],
      ['evidenceType', { evidenceType: 'document' }, { tenantId: 'tenant-123', evidenceType: 'document' }],
      ['uploadedBy', { uploadedBy: 'user-123' }, { tenantId: 'tenant-123', uploadedBy: 'user-123' }],
      ['verified true', { verified: true }, { tenantId: 'tenant-123', verified: true }],
      ['verified false', { verified: false }, { tenantId: 'tenant-123', verified: false }],
      ['archive true', { archive: true }, { tenantId: 'tenant-123', archive: true }],
      ['archive false', { archive: false }, { tenantId: 'tenant-123', archive: false }],
    ])('should filter by %s', async (_description, filterParam, expectedSelector) => {
      await service.queryDocuments({ tenantId: 'tenant-123', ...filterParam, page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: { ...expectedSelector, ...NOT_PENDING },
        }),
      );
    });

    it('should pass a real, non-empty tenantId through to the CouchDB selector', async () => {
      await service.queryDocuments({ tenantId: 'tenant-real-456', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: expect.objectContaining({ tenantId: 'tenant-real-456' }),
        }),
      );

      const call = (mockDb.find as jest.Mock).mock.calls[0][0];
      expect(call.selector.tenantId).toBe('tenant-real-456');
      expect(call.selector.tenantId).not.toBe('');
    });

    it('should filter by multiple fields', async () => {
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
            ...NOT_PENDING,
          },
        }),
      );
    });

    it('should handle search with text fields', async () => {
      await service.queryDocuments({ tenantId: 'tenant-123', search: 'test query', page: 1, limit: 10 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: {
            tenantId: 'tenant-123',
            $or: [
              { fileName: { $regex: 'test query' } },
              { description: { $regex: 'test query' } },
              { comments: { $regex: 'test query' } },
            ],
            ...NOT_PENDING,
          },
        }),
      );
    });

    it('should handle search with UUID (36 characters)', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      await service.queryDocuments({ tenantId: 'tenant-123', search: uuid, page: 1, limit: 10 });

      const call = (mockDb.find as jest.Mock).mock.calls[0][0];
      expect(call.selector.$or).toContainEqual({ id: uuid });
      expect(call.selector.$or).toContainEqual({ taskId: uuid });
    });

    it('should calculate skip correctly for different pages', async () => {
      await service.queryDocuments({ tenantId: 'tenant-123', page: 3, limit: 20 });

      expect(mockDb.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
        }),
      );
    });

    it('should handle query errors', async () => {
      mockDb.find.mockRejectedValue(new Error('Query failed'));

      await expect(service.queryDocuments({ tenantId: 'tenant-123', page: 1, limit: 10 })).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException when tenantId is an empty string', async () => {
      await expect(service.queryDocuments({ tenantId: '', page: 1, limit: 10 })).rejects.toThrow(BadRequestException);
      expect(mockDb.find).not.toHaveBeenCalled();
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

      await expect(service.getAttachment('doc-123', 'file.pdf')).rejects.toThrow('Attachment not found');
    });
  });

  describe('listDocuments', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      await service.onModuleInit();
    });

    it.each([
      ['default params', undefined, {}],
      ['custom params', { limit: 20, skip: 10 }, { limit: 20, skip: 10 }],
    ])('should list documents with %s', async (_description, params, expectedParams) => {
      const mockResponse = { total_rows: 10, rows: [] };
      mockDb.list.mockResolvedValue(mockResponse);

      const result = await service.listDocuments(params);

      expect(mockDb.list).toHaveBeenCalledWith(expectedParams);
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

  describe('onModuleInit — design document provisioning', () => {
    beforeEach(() => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
    });

    it('creates _design/evidence when the database has no design document', async () => {
      const notFound = Object.assign(new Error('missing'), { statusCode: 404 });
      mockDb.get.mockRejectedValueOnce(notFound);
      mockDb.insert.mockResolvedValueOnce({ ok: true, id: '_design/evidence', rev: '1-abc' });

      await service.onModuleInit();

      expect(mockDb.get).toHaveBeenCalledWith('_design/evidence');
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          views: expect.objectContaining({
            by_uploadedAt: expect.objectContaining({
              map: expect.stringContaining('doc.archive !== true'),
            }),
          }),
        }),
        '_design/evidence',
      );
    });

    it('does not recreate _design/evidence when it already exists', async () => {
      mockDb.get.mockResolvedValueOnce({ _id: '_design/evidence', _rev: '1-abc', views: {} });

      await service.onModuleInit();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('propagates errors other than 404 from the design-document GET', async () => {
      const boom = Object.assign(new Error('boom'), { statusCode: 500 });
      mockDb.get.mockRejectedValueOnce(boom);

      await expect(service.onModuleInit()).rejects.toThrow('boom');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('autoArchiveOldEvidence', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      mockDb.get.mockResolvedValue({ _id: '_design/evidence', _rev: '1-abc', views: {} });
      await service.onModuleInit();
    });

    it('archives old evidence that is not yet marked archive:true', async () => {
      const oldDoc = { _id: 'doc-123', _rev: '1-abc', fileName: 'old.pdf', archive: false };

      mockDb.view.mockResolvedValue({ rows: [{ doc: oldDoc }] });
      mockDb.insert.mockResolvedValue({ ok: true });

      await service.autoArchiveOldEvidence();

      expect(mockDb.view).toHaveBeenCalledWith('evidence', 'by_uploadedAt', expect.objectContaining({ include_docs: true }));
      expect(mockDb.insert).toHaveBeenCalledWith({
        ...oldDoc,
        archive: true,
        _id: 'doc-123',
        _rev: '1-abc',
      });
    });

    it('does not re-archive a document that already has archive:true', async () => {
      const archivedDoc = { _id: 'doc-456', _rev: '1-xyz', archive: true };

      mockDb.view.mockResolvedValue({ rows: [{ doc: archivedDoc }] });

      await service.autoArchiveOldEvidence();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle multiple documents', async () => {
      const docs = [
        { _id: 'doc-1', _rev: '1-a', archive: false },
        { _id: 'doc-2', _rev: '1-b', archive: false },
        { _id: 'doc-3', _rev: '1-c', archive: true },
      ];

      mockDb.view.mockResolvedValue({ rows: docs.map((doc) => ({ doc })) });
      mockDb.insert.mockResolvedValue({ ok: true });

      await service.autoArchiveOldEvidence();

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['empty results', { rows: [] }],
      ['view error', null],
    ])('should handle %s gracefully', async (_description, viewResult) => {
      if (viewResult === null) {
        mockDb.view.mockRejectedValue(new Error('View failed'));
      } else {
        mockDb.view.mockResolvedValue(viewResult);
      }

      await expect(service.autoArchiveOldEvidence()).resolves.not.toThrow();
      if (viewResult?.rows.length === 0) {
        expect(mockDb.insert).not.toHaveBeenCalled();
      }
    });
  });

  describe('pending evidence', () => {
    beforeEach(async () => {
      mockNanoInstance.db.list.mockResolvedValue(['cms-evidence']);
      mockDb.get.mockResolvedValue({ _id: '_design/evidence', _rev: '1-abc', views: {} });
      await service.onModuleInit();
    });

    it('excludes unfinished uploads in the query itself, for both the page and the count, and returns the page as is', async () => {
      const committed = { _id: 'a', status: 'committed' };
      const legacy = { _id: 'b' };
      mockDb.find.mockResolvedValueOnce({ docs: [committed, legacy] }).mockResolvedValueOnce({ docs: [committed, legacy] });

      const result = await service.queryDocuments({ tenantId: 'tenant-123', page: 1, limit: 2 });

      const [pageQuery, countQuery] = (mockDb.find as jest.Mock).mock.calls.map((call) => call[0]);
      expect(pageQuery.selector.$and).toEqual(NOT_PENDING.$and);
      expect(countQuery.selector.$and).toEqual(NOT_PENDING.$and);
      // Nothing is dropped after the query, so a page is never shorter than the limit because of pending documents.
      expect(result.data).toEqual([committed, legacy]);
    });

    it('keeps the status condition apart from the search $or so both apply', async () => {
      mockDb.find.mockResolvedValue({ docs: [] });
      await service.queryDocuments({ tenantId: 'tenant-123', search: 'x', page: 1, limit: 10 });

      const { selector } = (mockDb.find as jest.Mock).mock.calls[0][0];
      expect(selector.$or).toHaveLength(3);
      expect(selector.$and).toEqual(NOT_PENDING.$and);
    });

    describe('findPendingEvidenceOlderThan', () => {
      it('queries pending documents uploaded before the cutoff, up to the limit, and returns them', async () => {
        const docs = [
          { _id: 'ev_1_1', _rev: '1-a' },
          { _id: 'ev_1_2', _rev: '2-b' },
        ];
        mockDb.find.mockResolvedValue({ docs });

        const result = await service.findPendingEvidenceOlderThan('2026-10-30T11:58:00.000Z', 200);

        expect(mockDb.find).toHaveBeenCalledWith({
          selector: { status: 'pending', uploadedAt: { $lt: '2026-10-30T11:58:00.000Z' } },
          limit: 200,
        });
        expect(result).toEqual(docs);
      });

      it('returns an empty list when nothing is pending', async () => {
        mockDb.find.mockResolvedValue({ docs: [] });

        await expect(service.findPendingEvidenceOlderThan('2026-10-30T11:58:00.000Z', 200)).resolves.toEqual([]);
      });

      it('lets a query failure reach the caller, which decides what to do', async () => {
        mockDb.find.mockRejectedValue(new Error('couch down'));

        await expect(service.findPendingEvidenceOlderThan('2026-10-30T11:58:00.000Z', 200)).rejects.toThrow('couch down');
      });
    });
  });
});
