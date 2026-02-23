import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { EvidenceRepository } from '../src/modules/repository/evidence.repository';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import { BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
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
        hash: 'bb910c5d19777f76c8c92c6f471fc106254cd7fc9a3491415fafd287eb49f0e5', // SHA256 hash of Buffer.from('encrypted content')
        encryption: {
          key: Buffer.alloc(32, 'a').toString('base64'), // 32-byte key for AES-256
          iv: Buffer.alloc(12, 'b').toString('base64'), // 12-byte IV for GCM
          authTag: Buffer.alloc(16, 'c').toString('base64'), // 16-byte auth tag
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      task: {
        findUnique: jest.fn(),
      },
    };

    const mockCouchdbService = {
      insertDocument: jest.fn(),
      insertAttachment: jest.fn(),
      updateDocument: jest.fn(),
      getDocument: jest.fn(),
      deleteEvidence: jest.fn(),
      queryDocuments: jest.fn(),
      getAttachment: jest.fn(),
    };

    const mockAuditLogService = {
      logAction: jest.fn(),
    };

    const mockEvidenceRepository = {
      createEvidence: jest.fn(),
      deleteEvidenceById: jest.fn(),
    };

    const mockTaskRepository = {
      findTaskWithCase: jest.fn(),
    };

    const mockEventLogService = {
      logEventAction: jest.fn(),
    };

    const mockTaskHistoryService = {
      logTaskHistoryAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EvidenceRepository, useValue: mockEvidenceRepository },
        { provide: TaskRepository, useValue: mockTaskRepository },
        { provide: EventLogService, useValue: mockEventLogService },
        { provide: TaskHistoryService, useValue: mockTaskHistoryService },
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

    it('should successfully upload KYC evidence', async () => {
      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

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

    it('should successfully upload ADVERSE_MEDIA evidence with metadata', async () => {
      const adverseMediaDto = {
        ...uploadDto,
        evidenceType: EvidenceType.ADVERSE_MEDIA,
        aggregator: 'Test Aggregator',
        dateSearched: new Date().toISOString(),
        keywords: 'fraud, money laundering',
        findings: 'Test findings',
      } as any;

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

      const result = await service.uploadEvidence([mockFile], adverseMediaDto, userId, tenantId);

      expect(result).toBeDefined();
      expect(result.evidenceType).toBe(EvidenceType.ADVERSE_MEDIA);
    });

    it('should successfully upload SANCTIONS evidence with metadata', async () => {
      const sanctionsDto = {
        ...uploadDto,
        evidenceType: EvidenceType.SANCTIONS,
        screeningDate: new Date().toISOString(),
        tool: 'OFAC Screening Tool',
        summaryDisposition: 'No matches found',
      } as any;

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

      const result = await service.uploadEvidence([mockFile], sanctionsDto, userId, tenantId);

      expect(result).toBeDefined();
      expect(result.evidenceType).toBe(EvidenceType.SANCTIONS);
    });

    it('should upload EDD evidence type', async () => {
      const eddDto = { ...uploadDto, evidenceType: EvidenceType.EDD } as any;

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

      const result = await service.uploadEvidence([mockFile], eddDto, userId, tenantId);

      expect(result.evidenceType).toBe(EvidenceType.EDD);
    });

    it('should upload SAR_STR_FILING evidence type', async () => {
      const sarDto = { ...uploadDto, evidenceType: EvidenceType.SAR_STR_FILING } as any;

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

      const result = await service.uploadEvidence([mockFile], sarDto, userId, tenantId);

      expect(result.evidenceType).toBe(EvidenceType.SAR_STR_FILING);
    });

    it('should upload OTHER evidence type with audio files', async () => {
      const otherDto = { ...uploadDto, evidenceType: EvidenceType.OTHER } as any;
      const audioFile = { ...mockFile, mimetype: 'audio/mpeg', originalname: 'test.mp3' };

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-3' });

      const result = await service.uploadEvidence([audioFile], otherDto, userId, tenantId);

      expect(result.evidenceType).toBe(EvidenceType.OTHER);
    });

    it('should throw BadRequestException when uploading too many files for KYC', async () => {
      const files = Array(6).fill(mockFile); // 6 files, max is 5

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

    it('should handle multiple files upload', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.pdf' }];

      prismaService.task.findUnique.mockResolvedValueOnce(mockTask);
      taskRepository.findTaskWithCase.mockResolvedValueOnce(mockTask);
      couchdbService.insertDocument.mockResolvedValueOnce({ rev: 'rev-1' });
      couchdbService.insertAttachment
        .mockResolvedValueOnce({ rev: 'rev-2', filePath: '/path/to/file1' })
        .mockResolvedValueOnce({ rev: 'rev-3', filePath: '/path/to/file2' });
      couchdbService.updateDocument.mockResolvedValueOnce({ rev: 'rev-4' });

      const result = await service.uploadEvidence(files, uploadDto, userId, tenantId);

      expect(result).toBeDefined();
      expect(evidenceRepository.createEvidence).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should successfully delete evidence', async () => {
      couchdbService.getDocument.mockResolvedValueOnce(mockEvidenceDoc);
      couchdbService.deleteEvidence.mockResolvedValueOnce({ ok: true });

      const result = await service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId);

      expect(result).toBeDefined();
      expect(couchdbService.deleteEvidence).toHaveBeenCalled();
      expect(evidenceRepository.deleteEvidenceById).toHaveBeenCalledWith('ev_1_123456', tenantId);
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when evidenceId is null', async () => {
      await expect(service.deleteEvidence(null as any, 'test.pdf', userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when evidenceId is empty string', async () => {
      await expect(service.deleteEvidence('', 'test.pdf', userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when fileName is null', async () => {
      await expect(service.deleteEvidence('ev_1_123456', null as any, userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when fileName is empty string', async () => {
      await expect(service.deleteEvidence('ev_1_123456', '', userId, tenantId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when evidence is not found', async () => {
      couchdbService.getDocument.mockResolvedValueOnce(null);

      await expect(service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should propagate errors from couchdb delete operation', async () => {
      couchdbService.getDocument.mockResolvedValueOnce(mockEvidenceDoc);
      couchdbService.deleteEvidence.mockRejectedValueOnce(new Error('CouchDB error'));

      await expect(service.deleteEvidence('ev_1_123456', 'test.pdf', userId, tenantId)).rejects.toThrow('CouchDB error');
    });
  });

  describe('getEvidenceById', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should successfully get evidence as CMS_INVESTIGATOR', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_INVESTIGATOR');

      expect(result).toBeDefined();
      expect(result.id).toBe('ev_1_123456');
      expect(couchdbService.queryDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          evidenceId: 'ev_1_123456',
          uploadedBy: userId,
        })
      );
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should successfully get evidence as CMS_SUPERVISOR', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.id).toBe('ev_1_123456');
    });

    it('should successfully get evidence as CMS_AUDITOR', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_AUDITOR');

      expect(result).toBeDefined();
    });

    it('should successfully get evidence as CMS_COMPLIANCE_OFFICER', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_COMPLIANCE_OFFICER');

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceById('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when evidence is not found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

      await expect(service.getEvidenceById('ev_1_123456', userId, tenantId, 'CMS_INVESTIGATOR')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('downloadEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should successfully download evidence', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));
      
      // Spy on the private decrypt method
      jest.spyOn(service as any, 'decrypt').mockReturnValueOnce(Buffer.from('decrypted content'));

      const result = await service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.files).toHaveLength(1);
      expect(result.metadata).toBeDefined();
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should successfully download specific attachment by name', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));
      
      // Spy on the private decrypt method
      jest.spyOn(service as any, 'decrypt').mockReturnValueOnce(Buffer.from('decrypted content'));

      const result = await service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'test.pdf');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].attachmentMeta.fileName).toBe('test.pdf');
    });

    it('should handle investigation reports', async () => {
      const reportDoc = { ...mockEvidenceDoc, evidenceId: 'InvestigationReport_123' };
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [reportDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));
      
      // Spy on the private decrypt method
      jest.spyOn(service as any, 'decrypt').mockReturnValueOnce(Buffer.from('decrypted content'));

      const result = await service.downloadEvidence('InvestigationReport_123', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when evidence is not found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no attachments found', async () => {
      const docWithoutAttachments = { ...mockEvidenceDoc, metadata: [] };
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [docWithoutAttachments] });

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when requested attachment not found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'nonexistent.pdf')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when hash verification fails', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('different content'));

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockRejectedValueOnce(new Error('Unexpected error'));

      await expect(service.downloadEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyEvidence', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should successfully verify all attachments', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));
      
      // Spy on the private decrypt method
      jest.spyOn(service as any, 'decrypt').mockReturnValueOnce(Buffer.from('decrypted content'));

      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.verified).toBe(true);
      expect(result.details).toHaveLength(1);
      expect(result.details![0].verified).toBe(true);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'EVIDENCE_VERIFIED',
          outcome: 'SUCCESS',
        })
      );
    });

    it('should verify specific attachment by name', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));
      
      // Spy on the private decrypt method
      jest.spyOn(service as any, 'decrypt').mockReturnValueOnce(Buffer.from('decrypted content'));

      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'test.pdf');

      expect(result.verified).toBe(true);
    });

    it('should handle hash mismatch verification failure', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('different encrypted content'));

      const result = await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.verified).toBe(false);
      expect(result.details![0].verified).toBe(false);
      expect(result.details![0].reason).toBe('encrypted hash mismatch');
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'EVIDENCE_VERIFICATION_FAILED',
          outcome: 'FAILURE',
        })
      );
    });

    it('should filter evidence by uploadedBy for CMS_INVESTIGATOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockResolvedValueOnce(Buffer.from('encrypted content'));

      await service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_INVESTIGATOR');

      expect(couchdbService.queryDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedBy: userId,
        })
      );
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when evidence not found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no attachments found', async () => {
      const docWithoutAttachments = { ...mockEvidenceDoc, metadata: [] };
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [docWithoutAttachments] });

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when requested attachment not found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR', 'nonexistent.pdf')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });
      couchdbService.getAttachment.mockImplementationOnce(() => Promise.reject(new Error('Unexpected error')));

      await expect(service.verifyEvidence('ev_1_123456', userId, tenantId, 'CMS_SUPERVISOR')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getEvidenceByTaskId', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const taskId = 1;

    it('should successfully get evidence list by task ID', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.evidence).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.taskId).toBe(taskId);
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

      const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.evidence).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should work for CMS_INVESTIGATOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, 'CMS_INVESTIGATOR');

      expect(result).toBeDefined();
    });

    it('should work for CMS_COMPLIANCE_OFFICER role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByTaskId(taskId, userId, tenantId, 'CMS_COMPLIANCE_OFFICER');

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceByTaskId(taskId, userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getEvidenceByCaseId', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const caseId = 100;

    it('should successfully get evidence list by case ID', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByCaseId(caseId, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.evidence).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should filter by uploadedBy for CMS_INVESTIGATOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      await service.getEvidenceByCaseId(caseId, userId, tenantId, 'CMS_INVESTIGATOR');

      expect(couchdbService.queryDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedBy: userId,
        })
      );
    });

    it('should work for CMS_AUDITOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByCaseId(caseId, userId, tenantId, 'CMS_AUDITOR');

      expect(result).toBeDefined();
    });

    it('should work for CMS_COMPLIANCE_OFFICER role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByCaseId(caseId, userId, tenantId, 'CMS_COMPLIANCE_OFFICER');

      expect(result).toBeDefined();
    });

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

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

    it('should successfully get evidence list by type', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.evidence).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.evidenceType).toBe(evidenceType);
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should filter by uploadedBy for CMS_INVESTIGATOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_INVESTIGATOR');

      expect(couchdbService.queryDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedBy: userId,
        })
      );
    });

    it('should work for CMS_AUDITOR role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_AUDITOR');

      expect(result).toBeDefined();
    });

    it('should work for CMS_COMPLIANCE_OFFICER role', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [mockEvidenceDoc] });

      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_COMPLIANCE_OFFICER');

      expect(result).toBeDefined();
    });

    it('should return empty array when no evidence found', async () => {
      couchdbService.queryDocuments.mockResolvedValueOnce({ data: [] });

      const result = await service.getEvidenceByType(evidenceType as any, userId, tenantId, 'CMS_SUPERVISOR');

      expect(result.evidence).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw UnauthorizedException for invalid role', async () => {
      await expect(service.getEvidenceByType(evidenceType as any, userId, tenantId, 'INVALID_ROLE')).rejects.toThrow(UnauthorizedException);
    });
  });
});
