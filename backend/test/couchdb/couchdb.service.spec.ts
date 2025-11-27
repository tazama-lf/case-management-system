import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CouchdbService } from '../../src/couchdb/couchdb.service';

describe('CouchdbService', () => {
  let service: CouchdbService;
  let configService: Partial<ConfigService>;
  let mockDb: any;

  const configValues: Record<string, any> = {
    COUCHDB_URL: 'http://localhost:5984',
    COUCHDB_USERNAME: 'tester',
    COUCHDB_PASSWORD: 'secret',
    COUCHDB_DATABASE: 'evidence_store',
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key in configValues) return configValues[key];
        return defaultValue;
      }),
    };
    service = new CouchdbService(configService as ConfigService);
    mockDb = {
      insert: jest.fn(),
      get: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      createIndex: jest.fn(),
      attachment: {
        insert: jest.fn(),
        get: jest.fn(),
      },
      view: jest.fn(),
      config: {
        url: 'http://localhost:5984',
        db: 'evidence_store',
      },
    };
    (service as any).db = mockDb;
  });

  it('should initialize CouchDB database when missing', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockResolvedValue({});
    const use = jest.fn().mockReturnValue(mockDb);
    (service as any).nanoInstance = {
      db: {
        list,
        create,
      },
      use,
    };

    await service.onModuleInit();

    expect(list).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith('evidence_store');
    expect(use).toHaveBeenCalledWith('evidence_store');
    expect((service as any).db).toBe(mockDb);
  });

  it('should insert attachment and return couch path', async () => {
    mockDb.attachment.insert.mockResolvedValue({ ok: true, id: 'doc1', rev: '2-xyz' });
    const result = await service.insertAttachment('doc1', '1-abc', 'file name.pdf', Buffer.from('data'), 'application/pdf');
    expect(mockDb.attachment.insert).toHaveBeenCalled();
    expect(result.filePath).toBe('http://localhost:5984/evidence_store/doc1/file%20name.pdf');
  });

  it('should reject invalid pagination arguments when querying', async () => {
    await expect(
      service.queryDocuments({ tenantId: 'tenant1', page: 0, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.queryDocuments({ tenantId: 'tenant1', page: 1, limit: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should build selectors and return paged results', async () => {
    mockDb.find
      .mockResolvedValueOnce({ docs: [{ evidenceId: 'ev1' }] })
      .mockResolvedValueOnce({ docs: [{}, {}, {}] });

    const result = await service.queryDocuments({
      tenantId: 'tenant1',
      taskId: 'task1',
      evidenceType: 'KYC',
      archive: false,
      page: 1,
      limit: 10,
    });

    expect(mockDb.find).toHaveBeenCalledTimes(2);
    expect(result.data[0].evidenceId).toBe('ev1');
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(1);
  });

  it('should merge updates while retaining attachments', async () => {
    mockDb.get.mockResolvedValue({
      _id: 'doc1',
      _rev: '1-abc',
      field: 'old',
      _attachments: { sample: {} },
    });
    mockDb.insert.mockResolvedValue({ ok: true });

    await service.updateDocument('doc1', { field: 'new', extra: 'value' });

    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'new',
        extra: 'value',
        _attachments: { sample: {} },
        _rev: '1-abc',
      }),
    );
  });

  it('should fetch attachments as buffers', async () => {
    const buffer = Buffer.from('file');
    mockDb.attachment.get.mockResolvedValue(buffer);

    const result = await service.getAttachment('doc1', 'file.pdf');
    expect(mockDb.attachment.get).toHaveBeenCalledWith('doc1', 'file.pdf');
    expect(result).toBe(buffer);
  });

  it('should auto archive old evidence without archiveFlag', async () => {
    const insert = jest.fn();
    mockDb.insert = insert;
    mockDb.view.mockResolvedValue({
      rows: [
        {
          doc: {
            _id: 'doc1',
            _rev: '1-abc',
            uploadedAt: '2024-01-01T00:00:00.000Z',
            archiveFlag: false,
          },
        },
      ],
    });

    await service.autoArchiveOldEvidence();

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'doc1',
        _rev: '1-abc',
        archive: true,
      }),
    );
  });
});

