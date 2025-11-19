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
    attachmentName?: string,
  ): Promise<{ files: { file: Buffer; attachmentMeta: any }[]; metadata: EvidenceResponseDto }> {
    this.logger.log(`Downloading evidence ${evidenceId}`);

    const query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    const attachments = evidenceDoc.attachments || [];
    if (!attachments.length) throw new NotFoundException('No attachments found for this evidence');

    const targets = attachmentName ? attachments.filter((a) => a.fileName === attachmentName) : attachments;
    console.log("targets: ", targets);

    if (!targets.length) throw new NotFoundException('Requested attachment not found');

    const files: { file: Buffer; attachmentMeta: any }[] = [];

    try {
      for (const att of targets) {
        const encryptedRaw = await this.couchdb.getAttachment(evidenceId, att.fileName);
        const encryptedBuffer: Buffer = Buffer.isBuffer(encryptedRaw) ? encryptedRaw : Buffer.from(encryptedRaw);

        const encryptedHash = this.sha256(encryptedBuffer);
        if (encryptedHash !== att.hash) {
          this.logger.error(
            `Encrypted hash mismatch for evidence=${evidenceId} attachment=${att.fileName}. Expected=${att.hash} Got=${encryptedHash}`,
          );
          throw new BadRequestException('Evidence integrity check failed (encrypted hash mismatch)');
        }

        const file = this.decrypt(encryptedBuffer, att.encryption.key, att.encryption.iv, att.encryption.authTag);

        files.push({
          file,
          attachmentMeta: {
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            hash: att.hash,
            encryption: att.encryption,
            filePath: att.filePath,
          },
        });
      }

      await this.auditLog.logAction({
        userId,
        operation: 'download',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_DOWNLOADED',
        outcome: 'SUCCESS',
      });

      return {
        files,
        metadata: {
          id: evidenceDoc.evidenceId,
          taskId: evidenceDoc.taskId,
          evidenceType: evidenceDoc.evidenceType,
          uploadedBy: evidenceDoc.uploadedBy,
          uploadedAt: evidenceDoc.uploadedAt,
          tags: evidenceDoc.tags,
          description: evidenceDoc.description,
          comments: evidenceDoc.comments,
          attachments: evidenceDoc.attachments,
          fileName: evidenceDoc.fileName,
          fileSize: evidenceDoc.attachments[0].fileSize,
          mimeType: evidenceDoc.attachments[0].mimeType,
          hash: evidenceDoc.attachments[0].hash,
          archive: evidenceDoc.archive,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to download evidence: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to download evidence');
    }
  }

  async verifyEvidence(
    evidenceId: string,
    userId: string,
    tenantId: string,
    role: string,
    attachmentName?: string,
  ): Promise<VerifyEvidenceDto & { details?: any[] }> {
    this.logger.log(`Verifying evidence ${evidenceId}`);

    const query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    const attachments = evidenceDoc.attachments || [];
    if (!attachments.length) throw new NotFoundException('No attachments found for this evidence');

    const targets = attachmentName ? attachments.filter((a) => a.fileName === attachmentName) : attachments;

    if (!targets.length) throw new NotFoundException('Requested attachment not found');

    const details: any[] = [];
    let allVerified = true;

    try {
      for (const att of targets) {
        const encryptedRaw = await this.couchdb.getAttachment(evidenceId, att.fileName);
        const encryptedBuffer: Buffer = Buffer.isBuffer(encryptedRaw) ? encryptedRaw : Buffer.from(encryptedRaw);

        const encryptedHash = this.sha256(encryptedBuffer);
        if (encryptedHash !== att.hash) {
          details.push({
            fileName: att.fileName,
            verified: false,
            reason: 'encrypted hash mismatch',
            expectedHash: att.hash,
            actualHash: encryptedHash,
          });
          allVerified = false;
          continue;
        }

        let decrypted: Buffer;
        try {
          decrypted = this.decrypt(encryptedBuffer, att.encryption.key, att.encryption.iv, att.encryption.authTag);
        } catch (decErr) {
          this.logger.error(`Decryption failed for ${evidenceId}:${att.fileName} - ${decErr.message}`);
          details.push({
            fileName: att.fileName,
            verified: false,
            reason: 'decryption failed',
            error: decErr.message,
          });
          allVerified = false;
          continue;
        }

        details.push({
          fileName: att.fileName,
          verified: true,
          reason: 'ok',
          expectedEncryptedHash: att.hash,
          encryptedHash: encryptedHash,
        });
      }

      await this.auditLog.logAction({
        userId,
        operation: 'verify',
        entityName: 'Evidence',
        actionPerformed: allVerified ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFICATION_FAILED',
        outcome: allVerified ? 'SUCCESS' : 'FAILURE',
      });

      return {
        evidenceId,
        expectedHash: targets.length === 1 ? targets[0].hash : undefined,
        verified: allVerified,
        message: allVerified ? 'All requested attachments verified' : 'One or more attachments failed verification',
        verifiedAt: new Date(),
        verifiedBy: userId,
        details,
      };
    } catch (error) {
      this.logger.error(`Failed to verify evidence: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) throw error;
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
