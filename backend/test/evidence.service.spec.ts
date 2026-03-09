import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { EvidenceRepository } from '../src/modules/repository/evidence.repository';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EvidenceType } from '../src/modules/evidence/dto/upload-evidence.dto';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let prismaService: any;
  let couchdbService: any;
  let auditLogService: any;
  let evidenceRepository: any;
  let taskRepository: any;
  let eventLogService: any;
  let taskHistoryService: any;

  const mockTask = {
    task_id: 1,
    case_id: 100,
    name: 'Test Task',
    status: 'STATUS_01_UNASSIGNED',
    tenant_id: 'tenant-123',
  };

  const mockEvidenceDoc = {
    _id: 'ev_1_123456',
    _rev: 'rev-123',
    evidenceId: 'ev_1_123456',
    tenantId: 'tenant-123',
    taskId: 1,
    caseId: 100,
    uploadedBy: 'user-123',
    uploadedAt: new Date(),
    evidenceType: 'KYC',
    tags: ['test'],
    description: 'Test evidence',
    comments: 'Test comments',
    archive: false,
    metadata: [
      {
        fileName: 'test.pdf',
        fileSize: 1024,
        filePath: '/path/to/test.pdf',
        mimeType: 'application/pdf',
        hash: 'bb910c5d19777f76c8c92c6f471fc106254cd7fc9a3491415fafd287eb49f0e5',
        encryption: {
          key: Buffer.alloc(32, 'a').toString('base64'),
          iv: Buffer.alloc(12, 'b').toString('base64'),
          authTag: Buffer.alloc(16, 'c').toString('base64'),
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: { task: { findUnique: jest.fn() } } },
        {
          provide: CouchdbService,
          useValue: {
            insertDocument: jest.fn(),
            insertAttachment: jest.fn(),
            updateDocument: jest.fn(),
            getDocument: jest.fn(),
            deleteEvidence: jest.fn(),
            queryDocuments: jest.fn(),
            getAttachment: jest.fn(),
          },
        },
        { provide: AuditLogService, useValue: { logAction: jest.fn() } },
        { provide: EvidenceRepository, useValue: { createEvidence: jest.fn(), deleteEvidenceById: jest.fn() } },
        { provide: TaskRepository, useValue: { findTaskWithCase: jest.fn() } },
        { provide: EventLogService, useValue: { logEventAction: jest.fn() } },
        { provide: TaskHistoryService, useValue: { logTaskHistoryAction: jest.fn() } },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    prismaService = module.get(PrismaService);
    couchdbService = module.get(CouchdbService);
    auditLogService = module.get(AuditLogService);
    evidenceRepository = module.get(EvidenceRepository);
    taskRepository = module.get(TaskRepository);
    eventLogService = module.get(EventLogService);
    taskHistoryService = module.get(TaskHistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const uploadDto = {
      taskId: 1,
      evidenceType: EvidenceType.KYC,
      tags: ['test'],
      description: 'Test evidence',
      comments: 'Test comments',
    } as any;

    const mockFile = {
      originalname: 'test.pdf',
      buffer: Buffer.from('test file content'),
      size: 1024,
      mimetype: 'application/pdf',
    };

    beforeEach(() => {
      prismaService.task.findUnique.mockResolvedValue(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValue(mockTask);
      couchdbService.insertDocument.mockResolvedValue({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValue({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-3' });
    });

    it('should successfully upload KYC evidence', async () => {
      const result = await service.uploadEvidence([mockFile], uploadDto, userId, tenantId);

      expect(result).toBeDefined();
      expect(result.evidenceType).toBe(EvidenceType.KYC);
      expect(prismaService.task.findUnique).toHaveBeenCalledWith({ where: { task_id: 1 } });
      expect(couchdbService.insertDocument).toHaveBeenCalled();
      expect(couchdbService.insertAttachment).toHaveBeenCalled();
      expect(evidenceRepository.createEvidence).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalled();
      expect(eventLogService.logEventAction).toHaveBeenCalled();
      expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalled();
    });

    it.each([
      [
        EvidenceType.ADVERSE_MEDIA,
        { aggregator: 'Test Aggregator', dateSearched: new Date().toISOString(), keywords: 'fraud', findings: 'Test' },
      ],
      [EvidenceType.SANCTIONS, { screeningDate: new Date().toISOString(), tool: 'OFAC Tool', summaryDisposition: 'No matches' }],
      [EvidenceType.EDD, {}],
      [EvidenceType.SAR_STR_FILING, {}],
      [EvidenceType.OTHER, {}],
    ])('should upload %s evidence type', async (evidenceType, metadata) => {
      const dto = { ...uploadDto, evidenceType, ...metadata } as any;

      const result = await service.uploadEvidence([mockFile], dto, userId, tenantId);

      expect(result.evidenceType).toBe(evidenceType);
    });

    it('should handle audio files for OTHER evidence type', async () => {
      const audioFile = { ...mockFile, mimetype: 'audio/mpeg', originalname: 'test.mp3' };
      const dto = { ...uploadDto, evidenceType: EvidenceType.OTHER } as any;

      const result = await service.uploadEvidence([audioFile], dto, userId, tenantId);

      expect(result.evidenceType).toBe(EvidenceType.OTHER);
    });

    it('should handle multiple files upload', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.pdf' }];

      couchdbService.insertAttachment
        .mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file1' })
        .mockResolvedValueOnce({ rev: 'rev-3', filePath: '/path/to/file2' });

      const result = await service.uploadEvidence(files, uploadDto, userId, tenantId);

      expect(result).toBeDefined();
      expect(evidenceRepository.createEvidence).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when uploading too many files for KYC', async () => {
      const files = Array(6).fill(mockFile);

      await expect(service.uploadEvidence(files, uploadDto, userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'video/mp4' };

      await expect(service.uploadEvidence([invalidFile], uploadDto, userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for file size exceeding 50MB', async () => {
      const largeFile = { ...mockFile, size: 51 * 1024 * 1024 };

      await expect(service.uploadEvidence([largeFile], uploadDto, userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when task is not found', async () => {
      prismaService.task.findUnique.mockResolvedValueOnce(null);

      await expect(service.uploadEvidence([mockFile], uploadDto, userId, tenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should successfully delete evidence', async () => {
      couchdbService.getDocument.mockResolvedValue(mockEvidenceDoc);
      couchdbService.deleteEvidence.mockResolvedValue({ ok: true });

      const result = await service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId);

      expect(result).toBeDefined();
      expect(couchdbService.deleteEvidence).toHaveBeenCalled();
      expect(evidenceRepository.deleteEvidenceById).toHaveBeenCalledWith('ev_1_123456', tenantId);
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it.each([
      ['', 'test.pdf'],
      ['ev_1_123456', ''],
    ])('should throw BadRequestException when evidenceId/fileName is empty', async (evidenceId, fileName) => {
      await expect(service.deleteEvidence(evidenceId as any, fileName as any, userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when evidence is not found', async () => {
      couchdbService.getDocument.mockResolvedValue(null);

      await expect(service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should propagate errors from couchdb delete operation', async () => {
      couchdbService.getDocument.mockResolvedValue(mockEvidenceDoc);
      couchdbService.deleteEvidence.mockRejectedValue(new Error('CouchDB error'));

      await expect(service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId)).rejects.toThrow('CouchDB error');
    });
  });

  describe('getEvidenceById', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
    });

    it.each([
      ['CMS_INVESTIGATOR', true],
      ['CMS_SUPERVISOR', false],
      ['CMS_AUDITOR', false],
      ['CMS_COMPLIANCE_OFFICER', false],
    ])('should get evidence for %s role', async (role, shouldFilterByUser) => {
      const result = await service.getEvidenceById('ev_1_123456', userId, tenantId, role);

      expect(result).toBeDefined();
      expect(result.id).toBe('ev_1_123456');
      if (shouldFilterByUser) {
        expect(couchdbService.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: userId }));
      }
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceById('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when evidence is not found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      await expect(service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_INVESTIGATOR')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('downloadEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValue(Buffer.from('encrypted content'));
      jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted content'));
    });

    it.each([['CMS_INVESTIGATOR'], ['CMS_SUPERVISOR'], ['CMS_AUDITOR'], ['CMS_COMPLIANCE_OFFICER']])(
      'should download evidence for %s role',
      async (role) => {
        const result = await service.downloadEvidence('ev_1_123456', userId, tenantId, role);

        expect(result).toBeDefined();
        expect(result.files).toHaveLength(1);
        expect(result.metadata).toBeDefined();
        expect(auditLogService.logAction).toHaveBeenCalled();
      },
    );

    it('should download specific attachment by name', async () => {
      const result = await service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'test.pdf');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].attachmentMeta.fileName).toBe('test.pdf');
    });

    it('should handle investigation reports', async () => {
      const reportDoc = { ...mockEvidenceDoc, evidenceId: 'InvestigationReport_123' };
      couchdbService.queryDocuments.mockResolvedValue({ data: [reportDoc] });

      const result = await service.downloadEvidence('InvestigationReport_123', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when evidence is not found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no attachments found', async () => {
      const docWithoutAttachments = { ...mockEvidenceDoc, metadata: [] };
      couchdbService.queryDocuments.mockResolvedValue({ data: [docWithoutAttachments] });

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when requested attachment not found', async () => {
      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'nonexistent.pdf')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when hash verification fails', async () => {
      couchdbService.getAttachment.mockResolvedValue(Buffer.from('different content'));

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      couchdbService.getAttachment.mockRejectedValue(new Error('Unexpected error'));

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValue(Buffer.from('encrypted content'));
      jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted content'));
    });

    it('should successfully verify all attachments', async () => {
      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.verified).toBe(true);
      expect(result.details).toHaveLength(1);
      expect(result.details![0].verified).toBe(true);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'EVIDENCE_VERIFIED',
          outcome: 'SUCCESS',
        }),
      );
    });

    it('should verify specific attachment by name', async () => {
      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'test.pdf');

      expect(result.verified).toBe(true);
    });

    it('should handle hash mismatch verification failure', async () => {
      couchdbService.getAttachment.mockResolvedValue(Buffer.from('different encrypted content'));

      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.verified).toBe(false);
      expect(result.details![0].verified).toBe(false);
      expect(result.details![0].reason).toBe('encrypted hash mismatch');
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'EVIDENCE_VERIFICATION_FAILED',
          outcome: 'FAILURE',
        }),
      );
    });

    it('should filter evidence by uploadedBy for CMS_INVESTIGATOR role', async () => {
      await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_INVESTIGATOR');

      expect(couchdbService.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: userId }));
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when evidence not found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no attachments found', async () => {
      const docWithoutAttachments = { ...mockEvidenceDoc, metadata: [] };
      couchdbService.queryDocuments.mockResolvedValue({ data: [docWithoutAttachments] });

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when requested attachment not found', async () => {
      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'nonexistent.pdf')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      couchdbService.getAttachment.mockImplementationOnce(() => Promise.reject(new Error('Unexpected error')));

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getEvidenceByTaskId', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const taskId = 1;

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
    });

    it.each([['CMS_INVESTIGATOR'], ['CMS_SUPERVISOR'], ['CMS_COMPLIANCE_OFFICER']])(
      'should get evidence by task ID for %s role',
      async (role) => {
        const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, role);

        expect(result).toBeDefined();
        expect(result.evidence).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.taskId).toBe(taskId);
        expect(auditLogService.logAction).toHaveBeenCalled();
      },
    );

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.evidence).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceByTaskId(taskId, userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getEvidenceByCaseId', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const caseId = 100;

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
    });

    it.each([
      ['CMS_INVESTIGATOR', true],
      ['CMS_SUPERVISOR', false],
      ['CMS_AUDITOR', false],
      ['CMS_COMPLIANCE_OFFICER', false],
    ])('should get evidence by case ID for %s role', async (role, shouldFilterByUser) => {
      const result = await service.getEvidenceByCaseId(caseId, userId, tenantId, role);

      expect(result).toBeDefined();
      expect(result.evidence).toHaveLength(1);
      expect(result.total).toBe(1);
      if (shouldFilterByUser) {
        expect(couchdbService.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: userId }));
      }
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      const result = await service.getEvidenceByCaseId(caseId, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.evidence).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceByCaseId(caseId, userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getEvidenceByType', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const evidenceType = 'KYC';

    beforeEach(() => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [mockEvidenceDoc] });
    });

    it.each([
      ['CMS_INVESTIGATOR', true],
      ['CMS_SUPERVISOR', false],
      ['CMS_AUDITOR', false],
      ['CMS_COMPLIANCE_OFFICER', false],
    ])('should get evidence by type for %s role', async (role, shouldFilterByUser) => {
      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, role);

      expect(result).toBeDefined();
      expect(result.evidence).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.evidenceType).toBe(evidenceType);
      if (shouldFilterByUser) {
        expect(couchdbService.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: userId }));
      }
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValue({ data: [] });

      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.evidence).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceByType(evidenceType as any, userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });
  });
});
