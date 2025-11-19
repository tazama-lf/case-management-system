import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CouchdbService } from '../couchdb/couchdb.service';
import { AuditLogService } from '../audit/auditLog.service';
import * as crypto from 'crypto';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto, EvidenceType } from './dto';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private prisma: PrismaService,
    private couchdb: CouchdbService,
    private auditLog: AuditLogService,
  ) {}

  private sha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private encrypt(buffer: Buffer) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      key: key.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  private decrypt(enc: Buffer, key: string, iv: string, tag: string) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));

    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  async uploadEvidence(files: any[], dto: UploadEvidenceDto, userId: string, tenantId: string): Promise<EvidenceResponseDto> {
    const task = await this.prisma.task.findUnique({ where: { task_id: dto.taskId } });
    if (!task) throw new NotFoundException(`Task ${dto.taskId} not found`);

    const evidenceId = `ev_${dto.taskId}_${Date.now()}`;

    const metadata: any = {
      _id: evidenceId,
      evidenceId,
      tenantId,
      taskId: dto.taskId,
      uploadedBy: userId,
      uploadedAt: new Date(),
      evidenceType: dto.evidenceType,
      tags: dto.tags,
      description: dto.description,
      comments: dto.comments,
      archive: false,
      attachments: [],
    };

    if (dto.evidenceType === 'ADVERSE_MEDIA') {
      metadata.aggregator = dto.aggregator;
      metadata.dateSearched = dto.dateSearched;
      metadata.keywords = dto.keywords;
      metadata.findings = dto.findings;
    }

    if (dto.evidenceType === 'SANCTIONS') {
      metadata.screeningDate = dto.screeningDate;
      metadata.tool = dto.tool;
      metadata.summaryDisposition = dto.summaryDisposition;
    }

    const insertResult = await this.couchdb.insertDocument(evidenceId, metadata);
    let currentRev = insertResult.rev;

    for (const file of files) {
      const { encrypted, key, iv, authTag } = this.encrypt(file.buffer);
      const hash = this.sha256(encrypted);

      const attachmentResult = await this.couchdb.insertAttachment(evidenceId, currentRev, file.originalname, encrypted, file.mimetype);

      metadata.attachments.push({
        fileName: file.originalname,
        fileSize: file.size,
        filePath: attachmentResult.filePath,
        mimeType: file.mimetype,
        hash,
        encryption: { key, iv, authTag },
      });

      currentRev = attachmentResult.rev;
    }

    await this.couchdb.updateDocument(evidenceId, metadata);

    await this.auditLog.logAction({
      userId,
      operation: 'upload',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_UPLOADED',
      outcome: 'SUCCESS',
    });

    return metadata;
  }

  async getEvidenceById(evidenceId: string, userId: string, tenantId: string, userRole: string): Promise<EvidenceResponseDto> {
    this.logger.log(`Fetching evidence ${evidenceId}`);

    let query: any = {
      tenantId,
      evidenceId,
      archive: false,
      page: 1,
      limit: 1,
    };

    if (userRole === 'CMS_INVESTIGATOR') {
      query.uploadedBy = userId;
    } else if (userRole === 'CMS_AUDITOR' || userRole === 'CMS_SUPERVISOR' || userRole === 'CMS_COMPLIANCE_OFFICER') {
    } else {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];
    console.log('evidenceDoc: ', evidenceDoc);

    if (!evidenceDoc) {
      throw new ForbiddenException('Access denied or evidence not found');
    }

    await this.auditLog.logAction({
      userId,
      operation: 'view',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_VIEWED',
      outcome: 'SUCCESS',
    });

    return {
      id: evidenceDoc.evidenceId,
      taskId: evidenceDoc.taskId,
      fileName: evidenceDoc.fileName,
      evidenceType: evidenceDoc.evidenceType,
      fileSize: Number(evidenceDoc.fileSize),
      mimeType: evidenceDoc.mimeType,
      hash: evidenceDoc.hash,
      uploadedBy: evidenceDoc.uploadedBy,
      uploadedAt: evidenceDoc.uploadedAt,
      tags: evidenceDoc.tags,
      description: evidenceDoc.description,
      comments: evidenceDoc.comments,
      attachments: evidenceDoc.attachments,
      archive: evidenceDoc.archive,
    };
  }

  async downloadEvidence(
    evidenceId: string,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ file: Buffer; metadata: EvidenceResponseDto }> {
    this.logger.log(`Downloading evidence ${evidenceId}`);

    const query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    try {
      // Extract from attachments array (new structure) or root level (old structure)
      const firstAttachment = evidenceDoc.attachments?.[0];
      const fileName = evidenceDoc.fileName || firstAttachment?.fileName;
      const fileSize = evidenceDoc.fileSize || firstAttachment?.fileSize || 0;
      const mimeType = evidenceDoc.mimeType || firstAttachment?.mimeType || 'application/octet-stream';
      const hash = evidenceDoc.hash || firstAttachment?.hash || '';
      const encryptionKey = evidenceDoc.encryption_key || firstAttachment?.encryption?.key;
      const encryptionIv = evidenceDoc.encryption_meta?.iv || firstAttachment?.encryption?.iv;
      const encryptionAuthTag = evidenceDoc.encryption_meta?.authTag || firstAttachment?.encryption?.authTag;

      if (!fileName) {
        this.logger.error(`No fileName found in evidence ${evidenceId}`);
        throw new NotFoundException('File name not found in evidence document');
      }

      if (!encryptionKey || !encryptionIv || !encryptionAuthTag) {
        this.logger.error(`Missing encryption keys for evidence ${evidenceId}`);
        throw new NotFoundException('Encryption keys not found in evidence document');
      }

      this.logger.log(`Downloading attachment: ${fileName} for evidence ${evidenceId}`);

      const encryptedFile = await this.couchdb.getAttachment(evidenceId, fileName);
      if (!encryptedFile) {
        this.logger.error(`Attachment not found for evidenceId=${evidenceId}, name=${fileName}`);
        throw new NotFoundException('Encrypted file not found');
      }
      const encryptedBuffer = Buffer.isBuffer(encryptedFile) ? encryptedFile : Buffer.from(encryptedFile);

      this.logger.log(`Decrypting file: ${fileName}`);
      const file = this.decrypt(encryptedBuffer, encryptionKey, encryptionIv, encryptionAuthTag);

      const currentHash = this.sha256(file);
      if (currentHash !== hash) {
        this.logger.error(`Hash mismatch for ${evidenceId}. Expected: ${hash}, Got: ${currentHash}`);
        throw new BadRequestException('Evidence integrity check failed');
      }

      await this.auditLog.logAction({
        userId,
        operation: 'download',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_DOWNLOADED',
        outcome: 'SUCCESS',
      });

      return {
        file,
        metadata: {
          id: evidenceDoc.evidenceId,
          taskId: evidenceDoc.taskId,
          fileName,
          evidenceType: evidenceDoc.evidenceType,
          fileSize: Number(fileSize),
          mimeType,
          hash,
          uploadedBy: evidenceDoc.uploadedBy,
          uploadedAt: evidenceDoc.uploadedAt,
          tags: evidenceDoc.tags,
          description: evidenceDoc.description,
          comments: evidenceDoc.comments,
          attachments: evidenceDoc.attachments,
          archive: evidenceDoc.archive,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to download evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to download evidence');
    }
  }

  async verifyEvidence(evidenceId: string, userId: string, tenantId: string, role: string): Promise<VerifyEvidenceDto> {
    this.logger.log(`Verifying evidence ${evidenceId}`);

    const query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    try {
      const encryptedFile = await this.couchdb.getAttachment(evidenceId, evidenceDoc.fileName);
      const file = this.decrypt(
        encryptedFile,
        evidenceDoc.encryption_key,
        evidenceDoc.encryption_meta.iv,
        evidenceDoc.encryption_meta.authTag,
      );
      const verified = this.sha256(file) === evidenceDoc.hash;

      await this.auditLog.logAction({
        userId,
        operation: 'verify',
        entityName: 'Evidence',
        actionPerformed: verified ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFICATION_FAILED',
        outcome: verified ? 'SUCCESS' : 'FAILURE',
      });

      return {
        evidenceId,
        expectedHash: evidenceDoc.hash,
        verified,
        message: verified
          ? 'Evidence integrity verified successfully'
          : 'Evidence integrity check failed - file may have been tampered with',
        verifiedAt: new Date(),
        verifiedBy: userId,
      };
    } catch (error) {
      this.logger.error(`Failed to verify evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to verify evidence');
    }
  }

  async getEvidenceByTaskId(taskId: string, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const query: any = { tenantId, taskId, archive: false, page: 1, limit: 100 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const docs = result.data || [];

    const evidence = docs.map((item) => ({
      id: item.evidenceId,
      taskId: item.taskId,
      fileName: item.fileName,
      originalName: item.originalName,
      evidenceType: item.evidenceType,
      fileSize: Number(item.fileSize),
      mimeType: item.mimeType,
      hash: item.hash,
      uploadedBy: item.uploadedBy,
      uploadedAt: item.uploadedAt,
      tags: item.tags,
      description: item.description,
      comments: item.comments,
      attachments: item.attachments,
      archive: item.archive,
    }));

    await this.auditLog.logAction({
      userId,
      operation: 'view',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_LIST_VIEWED',
      outcome: 'SUCCESS',
    });

    return { evidence, total: evidence.length, taskId };
  }

  async getEvidenceByCaseId(caseId: string, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const tasks = await this.prisma.task.findMany({
      where: { case_id: caseId },
      select: { task_id: true },
    });

    const taskIds = tasks.map((t) => t.task_id).filter(Boolean);
    if (!taskIds.length) {
      return { evidence: [], total: 0 };
    }

    const allDocs: any[] = [];

    for (const taskId of taskIds) {
      const query: any = { tenantId, taskId, page: 1, limit: 100 };
      if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
      else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) {
        throw new UnauthorizedException('Invalid role');
      }

      const result = await this.couchdb.queryDocuments(query);
      const docs = result.data || [];
      allDocs.push(...docs);
    }

    const evidence = allDocs.map((item) => ({
      id: item.evidenceId,
      taskId: item.taskId,
      fileName: item.fileName,
      originalName: item.originalName,
      evidenceType: item.evidenceType,
      fileSize: Number(item.fileSize),
      mimeType: item.mimeType,
      hash: item.hash,
      uploadedBy: item.uploadedBy,
      uploadedAt: item.uploadedAt,
      tags: item.tags,
      description: item.description,
      comments: item.comments,
      attachments: item.attachments,
      archive: item.archive,
    }));

    await this.auditLog.logAction({
      userId,
      operation: 'view',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_LIST_VIEWED',
      outcome: 'SUCCESS',
    });

    return { evidence, total: evidence.length };
  }

  async getEvidenceByType(evidenceType: EvidenceType, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const query: any = { tenantId, evidenceType, archive: false, page: 1, limit: 100 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const docs = result.data || [];

    const evidence = docs.map((item) => ({
      id: item.evidenceId,
      taskId: item.taskId,
      fileName: item.fileName,
      originalName: item.originalName,
      evidenceType: item.evidenceType,
      fileSize: Number(item.fileSize),
      mimeType: item.mimeType,
      hash: item.hash,
      uploadedBy: item.uploadedBy,
      uploadedAt: item.uploadedAt,
      tags: item.tags,
      description: item.description,
      comments: item.comments,
      attachments: item.attachments,
      archive: item.archive,
    }));

    await this.auditLog.logAction({
      userId,
      operation: 'view',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_LIST_VIEWED',
      outcome: 'SUCCESS',
    });

    return { evidence, total: evidence.length, evidenceType };
  }
}
