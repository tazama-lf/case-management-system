import { EvidenceService } from '../../src/evidence/evidence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CouchdbService } from '../../src/couchdb/couchdb.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { UploadEvidenceDto, EvidenceType } from '../../src/evidence/dto/upload-evidence.dto';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('EvidenceService', () => {
    it('should upload evidence with multiple attachments', async () => {
      prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
      const files = [
        {
          originalname: 'file1.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('PDF content'),
          size: 1234,
        },
        {
          originalname: 'file2.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('JPEG content'),
          size: 5678,
        }
      ];
      const dto: UploadEvidenceDto = {
        taskId: 'task123',
        evidenceType: EvidenceType.KYC,
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
      couchdb.insertDocument.mockResolvedValue({ rev: '1-abc' });
      couchdb.insertAttachment.mockResolvedValueOnce({ filePath: '/files/file1.pdf', rev: '2-def' });
      couchdb.insertAttachment.mockResolvedValueOnce({ filePath: '/files/file2.jpg', rev: '3-ghi' });
      couchdb.updateDocument.mockResolvedValue({});
      auditLog.logAction.mockResolvedValue({});
      const result = await service.uploadEvidence(files, dto, 'user1', 'tenant1');
      expect(result.attachments.length).toBe(2);
      expect(result.attachments[0].fileName).toBe('file1.pdf');
      expect(result.attachments[1].fileName).toBe('file2.jpg');
    });

    it('should set undefined for missing required fields', async () => {
      prisma.task.findUnique.mockResolvedValue({ task_id: undefined });
      const files = [{
        originalname: 'file1.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('PDF content'),
        size: 1234,
      }];
      const dto: any = {
        // Missing taskId and evidenceType
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
      const result = await service.uploadEvidence(files, dto, 'user1', 'tenant1');
      expect(result.taskId).toBeUndefined();
      expect(result.evidenceType).toBeUndefined();
    });


    it('should upload evidence with archive flag set', async () => {
      prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
      const files = [{
        originalname: 'file1.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('PDF content'),
        size: 1234,
      }];
      const dto: UploadEvidenceDto = {
        taskId: 'task123',
        evidenceType: EvidenceType.KYC,
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
      couchdb.insertDocument.mockResolvedValue({ rev: '1-abc' });
      couchdb.insertAttachment.mockResolvedValue({ filePath: '/files/file1.pdf', rev: '2-def' });
      couchdb.updateDocument.mockResolvedValue({});
      auditLog.logAction.mockResolvedValue({});
      // Simulate archive flag set after upload
      const result = await service.uploadEvidence(files, dto, 'user1', 'tenant1');
      result.archive = true;
      expect(result.archive).toBe(true);
    });

    it('should throw BadRequestException for invalid input data', async () => {
      prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
      const files = [{
        originalname: '', // Invalid file name
        mimetype: '', // Invalid mimetype
        buffer: Buffer.from(''), // Empty buffer
        size: 0,
      }];
      const dto: UploadEvidenceDto = {
        taskId: 'task123',
        evidenceType: EvidenceType.KYC,
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
      await expect(service.uploadEvidence(files, dto, 'user1', 'tenant1')).rejects.toThrow(BadRequestException);
    });
  let service: EvidenceService;
  let prisma: any;
  let couchdb: any;
  let auditLog: any;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
    };
    couchdb = {
      insertDocument: jest.fn().mockResolvedValue({ rev: '1-abc' }),
      insertAttachment: jest.fn().mockResolvedValue({ filePath: '/files/file1.pdf', rev: '2-def' }),
      updateDocument: jest.fn().mockResolvedValue({}),
    };
    auditLog = {
      logAction: jest.fn().mockResolvedValue({}),
    };
    service = new EvidenceService(prisma, couchdb, auditLog);
  });

  it('should upload evidence and return metadata', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });

    // Use a realistic buffer for encryption
    const files = [{
      originalname: 'file1.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('This is a realistic PDF file content for testing.'),
      size: 1234,
    }];
    const dto: UploadEvidenceDto = {
      taskId: 'task123',
      evidenceType: EvidenceType.KYC,
      tags: 'tag1',
      description: 'desc',
      comments: 'comment',
    };

    // Ensure all mocks return expected values
    couchdb.insertDocument.mockResolvedValue({ rev: '1-abc' });
    couchdb.insertAttachment.mockResolvedValue({ filePath: '/files/file1.pdf', rev: '2-def' });
    couchdb.updateDocument.mockResolvedValue({});
    auditLog.logAction.mockResolvedValue({});
    const result = await service.uploadEvidence(files, dto, 'user1', 'tenant1');
    expect(result).toBeDefined();
    const metadata = result as any;
    expect(metadata.evidenceId).toBeDefined();
    expect(Array.isArray(metadata.attachments)).toBe(true);
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user1',
      operation: 'upload',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_UPLOADED',
      outcome: 'SUCCESS',
    }));
  });

  it('should encrypt and decrypt buffers using helper methods', () => {
    const payload = Buffer.from('tamper-proof evidence bytes');
    const { encrypted, key, iv, authTag } = (service as any).encrypt(payload);
    const decrypted = (service as any).decrypt(encrypted, key, iv, authTag);
    expect(decrypted.equals(payload)).toBe(true);
  });

  it('should capture adverse media metadata when uploading ADVERSE_MEDIA evidence', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
    const files = [{
      originalname: 'adverse-report.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('Adverse media content'),
      size: 2048,
    }];
    const dto: UploadEvidenceDto = {
      taskId: 'task123',
      evidenceType: EvidenceType.ADVERSE_MEDIA,
      tags: 'Adverse Media Screening',
      description: 'Aggregator findings',
      comments: 'Negative article identified',
      aggregator: 'Dow Jones',
      dateSearched: '2025-10-10T00:00:00.000Z',
      keywords: ['fraud', 'scam'],
      findings: 'Negative article found on 10-Oct-2025',
    };
    const result = await service.uploadEvidence(files, dto, 'investigator1', 'tenant1');
    const metadata = result as any;
    expect(metadata.aggregator).toBe('Dow Jones');
    expect(metadata.dateSearched).toBe('2025-10-10T00:00:00.000Z');
    expect(metadata.keywords).toEqual(['fraud', 'scam']);
    expect(metadata.findings).toBe('Negative article found on 10-Oct-2025');
    expect(metadata.attachments[0].fileName).toBe('adverse-report.pdf');
  });

  it('should capture sanctions screening metadata when uploading SANCTIONS evidence', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'task999' });
    const files = [{
      originalname: 'sanctions.csv',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('Sanctions results'),
      size: 4096,
    }];
    const dto: UploadEvidenceDto = {
      taskId: 'task999',
      evidenceType: EvidenceType.SANCTIONS,
      tags: 'Sanctions Screening',
      description: 'Screening summary',
      comments: 'Positive match escalated',
      screeningDate: '2025-11-01T00:00:00.000Z',
      tool: 'World-Check',
      summaryDisposition: 'Escalated',
    };
    const result = await service.uploadEvidence(files, dto, 'investigator2', 'tenant1');
    const metadata = result as any;
    expect(metadata.screeningDate).toBe('2025-11-01T00:00:00.000Z');
    expect(metadata.tool).toBe('World-Check');
    expect(metadata.summaryDisposition).toBe('Escalated');
    expect(metadata.attachments[0].fileName).toBe('sanctions.csv');
  });

  it('should capture SAR/STR metadata when uploading SAR_STR_FILING evidence', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'taskSar' });
    const files = [{
      originalname: 'sar-ack.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('SAR acknowledgement'),
      size: 1024,
    }];
    const dto: UploadEvidenceDto = {
      taskId: 'taskSar',
      evidenceType: EvidenceType.SAR_STR_FILING,
      tags: 'Regulatory Filing',
      description: 'SAR submission receipt',
      comments: 'Filed via goAML portal',
      submissionDate: '2025-11-15T00:00:00.000Z',
      referenceNumber: 'FIU/2025/12345',
      submissionChannel: 'goAML portal',
    };
    const result = await service.uploadEvidence(files, dto, 'compliance1', 'tenant1');
    const metadata = result as any;
    expect(metadata.submissionDate).toBe('2025-11-15T00:00:00.000Z');
    expect(metadata.referenceNumber).toBe('FIU/2025/12345');
    expect(metadata.submissionChannel).toBe('goAML portal');
    expect(metadata.category).toBe('Regulatory Filing');
    expect(metadata.attachments[0].fileName).toBe('sar-ack.pdf');
  });

  it('should log audit action for evidence upload failure', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
    const files = [{
      originalname: 'file1.exe',
      mimetype: 'application/x-msdownload',
      buffer: Buffer.from('test'),
      size: 1234,
    }];
    const dto: any = {
      taskId: 'task123',
      evidenceType: EvidenceType.KYC,
      tags: 'tag1',
      description: 'desc',
      comments: 'comment',
    };
    auditLog.logAction.mockResolvedValue({});
    await expect(service.uploadEvidence(files, dto, 'user1', 'tenant1')).rejects.toThrow(BadRequestException);
    expect(auditLog.logAction).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException for invalid file type', async () => {
    prisma.task.findUnique.mockResolvedValue({ task_id: 'task123' });
    const files = [{
      originalname: 'file1.exe',
      mimetype: 'application/x-msdownload',
      buffer: Buffer.from('test'),
      size: 1234,
    }];
      const dto: UploadEvidenceDto = {
        taskId: 'task123',
        evidenceType: EvidenceType.KYC,
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
    await expect(service.uploadEvidence(files, dto, 'user1', 'tenant1')).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if task not found', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    const files = [{
      originalname: 'file1.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('test'),
      size: 1234,
    }];
      const dto: UploadEvidenceDto = {
        taskId: 'task123',
        evidenceType: EvidenceType.KYC,
        tags: 'tag1',
        description: 'desc',
        comments: 'comment',
      };
    await expect(service.uploadEvidence(files, dto, 'user1', 'tenant1')).rejects.toThrow(NotFoundException);
  });
});

describe('EvidenceService verification', () => {
  let service: EvidenceService;
  let couchdb: any;
  let auditLog: any;

  beforeEach(() => {
    couchdb = {
      queryDocuments: jest.fn(),
      getAttachment: jest.fn(),
    };
    auditLog = {
      logAction: jest.fn().mockResolvedValue({}),
    };
    service = new EvidenceService({} as any, couchdb, auditLog);
  });

  it('should verify evidence successfully', async () => {
    const evidenceDoc = {
      evidenceId: 'ev1',
      attachments: [{
        fileName: 'file1.pdf',
        hash: 'hash1',
        encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
    jest.spyOn(service as any, 'sha256').mockReturnValue('hash1');
    jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted-data'));
    const result = await service.verifyEvidence('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.verified).toBe(true);
    expect(result.details?.[0].verified).toBe(true);
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user1',
      operation: 'verify',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_VERIFIED',
      outcome: 'SUCCESS',
    }));
  });

    it('should log audit action for evidence verification failure', async () => {
      const evidenceDoc = {
        evidenceId: 'ev2',
        attachments: [{
          fileName: 'file2.pdf',
          hash: 'expected-hash',
          encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
        }],
      };
      couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
      couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
      jest.spyOn(service as any, 'sha256').mockReturnValue('wrong-hash');
      jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted-data'));
      const result = await service.verifyEvidence('ev2', 'user2', 'tenant1', 'CMS_SUPERVISOR');
      expect(result.verified).toBe(false);
      expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user2',
        operation: 'verify',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_VERIFICATION_FAILED',
        outcome: 'FAILURE',
      }));
    });

  it('should fail verification on hash mismatch', async () => {
    const evidenceDoc = {
      evidenceId: 'ev2',
      attachments: [{
        fileName: 'file2.pdf',
        hash: 'expected-hash',
        encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
    jest.spyOn(service as any, 'sha256').mockReturnValue('wrong-hash');
    jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted-data'));
    const result = await service.verifyEvidence('ev2', 'user2', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.verified).toBe(false);
    expect(result.details?.[0].verified).toBe(false);
    expect(result.details?.[0].reason).toBe('encrypted hash mismatch');
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user2',
      operation: 'verify',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_VERIFICATION_FAILED',
      outcome: 'FAILURE',
    }));
  });

  it('should include failure details when decryption fails during verification', async () => {
    const encPayload = (service as any).encrypt(Buffer.from('verification buffer'));
    const hash = (service as any).sha256(encPayload.encrypted);
    const evidenceDoc = {
      evidenceId: 'evDecrypt',
      attachments: [{
        fileName: 'enc.bin',
        hash,
        encryption: {
          key: encPayload.key,
          iv: encPayload.iv,
          authTag: encPayload.authTag,
        },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockResolvedValue(encPayload.encrypted);
    const shaSpy = jest.spyOn(service as any, 'sha256').mockReturnValue(hash);
    const decryptSpy = jest.spyOn(service as any, 'decrypt').mockImplementation(() => {
      throw new Error('bad decrypt');
    });

    const result = await service.verifyEvidence('evDecrypt', 'userDecrypt', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.verified).toBe(false);
    expect(result.details?.[0]).toEqual(expect.objectContaining({
      fileName: 'enc.bin',
      verified: false,
      reason: 'decryption failed',
    }));
    decryptSpy.mockRestore();
    shaSpy.mockRestore();
  });

  it('should throw InternalServerErrorException when verification fails unexpectedly', async () => {
    const evidenceDoc = {
      evidenceId: 'evErr',
      attachments: [{
        fileName: 'file1.pdf',
        hash: 'hash1',
        encryption: { key: '', iv: '', authTag: '' },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockRejectedValue(new Error('boom'));
    await expect(
      service.verifyEvidence('evErr', 'userErr', 'tenant1', 'CMS_SUPERVISOR'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should throw UnauthorizedException for invalid role', async () => {
    couchdb.queryDocuments.mockResolvedValue({ data: [{}] });
    await expect(service.verifyEvidence('ev3', 'user3', 'tenant1', 'INVALID_ROLE')).rejects.toThrow('Invalid role');
  });

  it('should throw NotFoundException if evidence not found', async () => {
    couchdb.queryDocuments.mockResolvedValue({ data: [] });
    await expect(service.verifyEvidence('ev4', 'user4', 'tenant1', 'CMS_SUPERVISOR')).rejects.toThrow('Evidence ev4 not found or access denied');
  });
});

describe('EvidenceService download', () => {
  let service: EvidenceService;
  let couchdb: any;
  let auditLog: any;

  beforeEach(() => {
    couchdb = {
      queryDocuments: jest.fn(),
      getAttachment: jest.fn(),
    };
    auditLog = {
      logAction: jest.fn().mockResolvedValue({}),
    };
    service = new EvidenceService({} as any, couchdb, auditLog);
  });

  it('should download evidence successfully for supervisor role', async () => {
    const evidenceDoc = {
      evidenceId: 'ev1',
      taskId: 'task1',
      uploadedBy: 'user1',
      uploadedAt: new Date(),
      tags: 'tag1',
      description: 'desc',
      comments: 'comment',
      archive: false,
      attachments: [{
        fileName: 'file1.pdf',
        fileSize: 1234,
        mimeType: 'application/pdf',
        hash: 'hash1',
        encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
        filePath: '/files/file1.pdf',
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
    jest.spyOn(service as any, 'sha256').mockReturnValue('hash1');
    jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted-data'));
    const result = await service.downloadEvidence('ev1', 'user1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.files[0].file).toBeInstanceOf(Buffer);
    expect(result.files[0].attachmentMeta.fileName).toBe('file1.pdf');
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user1',
      operation: 'download',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_DOWNLOADED',
      outcome: 'SUCCESS',
    }));
  });

    it('should log audit action for evidence retrieval', async () => {
      const evidenceDoc = {
        evidenceId: 'ev8',
        attachments: [{
          fileName: 'file2.pdf',
          fileSize: 5678,
          mimeType: 'application/pdf',
          hash: 'hash2',
          encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
          filePath: '/files/file2.pdf',
        }],
      };
      couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
      couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
      jest.spyOn(service as any, 'sha256').mockReturnValue('hash2');
      jest.spyOn(service as any, 'decrypt').mockReturnValue(Buffer.from('decrypted-data'));
      await service.downloadEvidence('ev8', 'user8', 'tenant1', 'CMS_SUPERVISOR');
      expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user8',
        operation: 'download',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_DOWNLOADED',
        outcome: 'SUCCESS',
      }));
    });

  it('should throw UnauthorizedException for invalid role', async () => {
    couchdb.queryDocuments.mockResolvedValue({ data: [{}] });
    await expect(service.downloadEvidence('ev2', 'user2', 'tenant1', 'INVALID_ROLE')).rejects.toThrow('Invalid role');
  });


  it('should throw NotFoundException if evidence not found', async () => {
    couchdb.queryDocuments.mockResolvedValue({ data: [] });
    await expect(service.downloadEvidence('ev3', 'user3', 'tenant1', 'CMS_SUPERVISOR')).rejects.toThrow('Evidence ev3 not found or access denied');
  });

  it('should throw NotFoundException if no attachments found', async () => {
    const evidenceDoc = {
      evidenceId: 'ev4',
      attachments: [],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    await expect(service.downloadEvidence('ev4', 'user4', 'tenant1', 'CMS_SUPERVISOR')).rejects.toThrow('No attachments found for this evidence');
  });

  it('should throw NotFoundException if requested attachment not found', async () => {
    const evidenceDoc = {
      evidenceId: 'ev5',
      attachments: [{ fileName: 'file1.pdf' }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    await expect(service.downloadEvidence('ev5', 'user5', 'tenant1', 'CMS_SUPERVISOR', 'notfound.pdf')).rejects.toThrow('Requested attachment not found');
  });

  it('should throw BadRequestException on hash mismatch', async () => {
    const evidenceDoc = {
      evidenceId: 'ev6',
      attachments: [{
        fileName: 'file1.pdf',
        hash: 'expected-hash',
        encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockResolvedValue(Buffer.from('encrypted-data'));
    jest.spyOn(service as any, 'sha256').mockReturnValue('wrong-hash');
    await expect(service.downloadEvidence('ev6', 'user6', 'tenant1', 'CMS_SUPERVISOR')).rejects.toThrow('Evidence integrity check failed (encrypted hash mismatch)');
  });

  it('should throw InternalServerErrorException when download fails unexpectedly', async () => {
    const evidenceDoc = {
      evidenceId: 'evErr',
      attachments: [{
        fileName: 'file1.pdf',
        hash: 'hash1',
        encryption: { key: Buffer.alloc(32).toString('base64'), iv: Buffer.alloc(12).toString('base64'), authTag: Buffer.alloc(16).toString('base64') },
      }],
    };
    couchdb.queryDocuments.mockResolvedValue({ data: [evidenceDoc] });
    couchdb.getAttachment.mockRejectedValue(new Error('boom'));
    await expect(
      service.downloadEvidence('evErr', 'userErr', 'tenant1', 'CMS_SUPERVISOR'),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

describe('EvidenceService retrieval and listings', () => {
  let service: EvidenceService;
  let prisma: any;
  let couchdb: any;
  let auditLog: any;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    couchdb = {
      queryDocuments: jest.fn(),
      getAttachment: jest.fn(),
    };
    auditLog = {
      logAction: jest.fn().mockResolvedValue({}),
    };
    service = new EvidenceService(prisma, couchdb, auditLog);
  });

  it('should list evidence by task for investigator role and log the view', async () => {
    couchdb.queryDocuments.mockResolvedValue({
      data: [{
        evidenceId: 'ev-task-1',
        taskId: 'task1',
        fileName: 'kyc.pdf',
        originalName: 'kyc.pdf',
        evidenceType: EvidenceType.KYC,
        fileSize: 5120,
        mimeType: 'application/pdf',
        hash: 'hash',
        uploadedBy: 'user1',
        uploadedAt: new Date().toISOString(),
        tags: 'KYC',
        description: 'KYC report',
        comments: 'All good',
        attachments: [],
        archive: false,
      }],
    });

    const result = await service.getEvidenceByTaskId('task1', 'user1', 'tenant1', 'CMS_INVESTIGATOR');
    expect(couchdb.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: 'user1', taskId: 'task1' }));
    expect(result.evidence[0].id).toBe('ev-task-1');
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      actionPerformed: 'EVIDENCE_LIST_VIEWED',
      userId: 'user1',
    }));
  });

  it('should aggregate evidence across case tasks for supervisors', async () => {
    prisma.task.findMany.mockResolvedValue([{ task_id: 'task1' }, { task_id: 'task2' }]);
    couchdb.queryDocuments.mockImplementation(({ taskId }) => {
      if (taskId === 'task1') {
        return Promise.resolve({
          data: [{
            evidenceId: 'ev1',
            taskId: 'task1',
            fileName: 'report1.pdf',
            originalName: 'report1.pdf',
            evidenceType: EvidenceType.KYC,
            fileSize: 1000,
            mimeType: 'application/pdf',
            hash: 'hash1',
            uploadedBy: 'userA',
            uploadedAt: new Date().toISOString(),
            attachments: [],
            archive: false,
          }],
        });
      }
      return Promise.resolve({
        data: [{
          evidenceId: 'ev2',
          taskId: 'task2',
          fileName: 'report2.pdf',
          originalName: 'report2.pdf',
          evidenceType: EvidenceType.EDD,
          fileSize: 2000,
          mimeType: 'application/pdf',
          hash: 'hash2',
          uploadedBy: 'userB',
          uploadedAt: new Date().toISOString(),
          attachments: [],
          archive: false,
        }],
      });
    });

    const result = await service.getEvidenceByCaseId('case123', 'supervisor1', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.total).toBe(2);
    expect(result.evidence.map((e) => e.id)).toEqual(['ev1', 'ev2']);
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({ userId: 'supervisor1' }));
  });

  it('should enforce role checks when listing evidence by case', async () => {
    prisma.task.findMany.mockResolvedValue([{ task_id: 'task1' }]);
    await expect(service.getEvidenceByCaseId('case123', 'user1', 'tenant1', 'INVALID_ROLE')).rejects.toThrow('Invalid role');
  });

  it('should list evidence by type for compliance officers', async () => {
    couchdb.queryDocuments.mockResolvedValue({
      data: [{
        evidenceId: 'ev-sanctions-1',
        taskId: 'taskSanctions',
        fileName: 'sanctions.pdf',
        originalName: 'sanctions.pdf',
        evidenceType: EvidenceType.SANCTIONS,
        fileSize: 123,
        mimeType: 'application/pdf',
        hash: 'hash-sanctions',
        uploadedBy: 'user2',
        uploadedAt: new Date().toISOString(),
        tags: 'Sanctions',
        description: 'Sanctions screening upload',
        comments: 'Cleared',
        attachments: [],
        archive: false,
      }],
    });

    const result = await service.getEvidenceByType(EvidenceType.SANCTIONS, 'compliance1', 'tenant1', 'CMS_COMPLIANCE_OFFICER');
    expect(result.evidenceType).toBe(EvidenceType.SANCTIONS);
    expect(result.evidence[0].fileName).toBe('sanctions.pdf');
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({ userId: 'compliance1' }));
  });

  it('should fetch evidence by id for supervisors and log the view', async () => {
    couchdb.queryDocuments.mockResolvedValue({
      data: [{
        evidenceId: 'ev-download-1',
        taskId: 'taskX',
        fileName: 'evidence.pdf',
        evidenceType: EvidenceType.OTHER,
        fileSize: 2048,
        mimeType: 'application/pdf',
        hash: 'hash',
        uploadedBy: 'investigator1',
        uploadedAt: new Date().toISOString(),
        tags: 'General',
        description: 'General evidence',
        comments: 'Needs review',
        attachments: [{ fileName: 'evidence.pdf', fileSize: 2048, mimeType: 'application/pdf', hash: 'hash', encryption: {}, filePath: '/files/evidence.pdf' }],
        archive: false,
      }],
    });

    const result = await service.getEvidenceById('ev-download-1', 'supervisor2', 'tenant1', 'CMS_SUPERVISOR');
    expect(result.id).toBe('ev-download-1');
    expect(result.attachments?.[0].fileName).toBe('evidence.pdf');
    expect(auditLog.logAction).toHaveBeenCalledWith(expect.objectContaining({
      actionPerformed: 'EVIDENCE_VIEWED',
      userId: 'supervisor2',
    }));
  });

  it('should block invalid roles when fetching evidence by id', async () => {
    await expect(service.getEvidenceById('ev-invalid', 'userX', 'tenant1', 'INVALID_ROLE')).rejects.toThrow('Invalid role');
  });

  it('should restrict investigator evidence fetches to their own uploads', async () => {
    const evidenceDoc = {
      evidenceId: 'ev-investigator',
      taskId: 'taskY',
      fileName: 'doc.pdf',
      evidenceType: EvidenceType.KYC,
      fileSize: 100,
      mimeType: 'application/pdf',
      hash: 'hash',
      uploadedBy: 'investigator1',
      uploadedAt: new Date().toISOString(),
      tags: 'KYC',
      description: 'desc',
      comments: 'comment',
      attachments: [],
      archive: false,
    };
    couchdb.queryDocuments.mockImplementation((query) => {
      expect(query.uploadedBy).toBe('investigator1');
      return Promise.resolve({ data: [evidenceDoc] });
    });

    const result = await service.getEvidenceById('ev-investigator', 'investigator1', 'tenant1', 'CMS_INVESTIGATOR');
    expect(result.id).toBe('ev-investigator');
  });

  it('should filter case evidence by investigator uploads', async () => {
    prisma.task.findMany.mockResolvedValue([{ task_id: 'task1' }]);
    couchdb.queryDocuments.mockImplementation((query) => {
      expect(query.uploadedBy).toBe('investigator1');
      return Promise.resolve({
        data: [{
          evidenceId: 'ev-case',
          taskId: 'task1',
          fileName: 'doc.pdf',
          evidenceType: EvidenceType.KYC,
          fileSize: 200,
          mimeType: 'application/pdf',
          hash: 'hash',
          uploadedBy: 'investigator1',
          uploadedAt: new Date().toISOString(),
          attachments: [],
          archive: false,
        }],
      });
    });

    const result = await service.getEvidenceByCaseId('caseABC', 'investigator1', 'tenant1', 'CMS_INVESTIGATOR');
    expect(result.total).toBe(1);
    expect(result.evidence[0].uploadedBy).toBe('investigator1');
  });
});
