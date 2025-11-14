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
import { Evidence } from '@prisma/client';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private prisma: PrismaService,
    private couchdb: CouchdbService,
    private auditLog: AuditLogService,
  ) {}

  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private encryptBuffer(buffer: Buffer): { encrypted: Buffer; key: string; iv: string; authTag: string } {
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

  async uploadEvidence(file: any, dto: UploadEvidenceDto, userId: string, tenantId: string): Promise<EvidenceResponseDto> {
    this.logger.log(`Uploading evidence for task ${dto.taskId} by user ${userId}`);

    try {
      const taskExists = await this.prisma.task.findUnique({
        where: { task_id: dto.taskId },
      });

      if (!taskExists) {
        throw new NotFoundException(`Task ${dto.taskId} not found`);
      }

      const fileHash = this.calculateHash(file.buffer);
      this.logger.log(`File hash calculated: ${fileHash}`);

      const evidenceId = `evidence_${dto.taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { encrypted, key, iv, authTag } = this.encryptBuffer(file.buffer);

      const evidenceDoc = {
        _id: evidenceId,
        evidenceId: evidenceId,
        taskId: dto.taskId,
        tenantId: tenantId,
        userId: userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        type: dto.type,
        tags: dto.tags,
        hash: fileHash,
        description: dto.description,
        comments: dto.comments,
        uploadedBy: userId,
        uploadedAt: new Date(),
        encryption_meta: {
          iv,
          authTag,
        },
      };

      console.log('EvidenceDoc: ', evidenceDoc);

      const insertedEvidenceDoc = await this.couchdb.insertWithAttachment(
        evidenceId,
        evidenceDoc,
        file.originalname,
        file.buffer,
        file.mimetype,
      );

      this.logger.log(`Evidence stored in CouchDB: ${evidenceId}`);

      await this.auditLog.logAction({
        userId,
        operation: 'upload',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_UPLOADED',
        outcome: 'SUCCESS',
      });

      return {
        id: evidenceDoc.evidenceId,
        taskId: evidenceDoc.taskId,
        fileName: evidenceDoc.fileName,
        type: evidenceDoc.type,
        fileSize: Number(evidenceDoc.fileSize),
        mimeType: evidenceDoc.mimeType || file.mimetype,
        hash: evidenceDoc.hash,
        uploadedBy: evidenceDoc.uploadedBy,
        uploadedAt: evidenceDoc.uploadedAt,
        tags: evidenceDoc.tags,
        description: dto.description,
        comments: dto.comments,
        filePath: insertedEvidenceDoc,
        downloadUrl: `/api/evidenceDoc/${evidenceDoc.evidenceId}/download`,
        verified: true,
      };
    } catch (error) {
      this.logger.error(`Failed to upload evidence: ${error.message}`, error.stack);

      await this.auditLog.logAction({
        userId,
        operation: 'upload',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_UPLOAD_FAILED',
        outcome: 'FAILURE',
      });

      throw new InternalServerErrorException('Failed to upload evidence');
    }
  }

  async getEvidenceByTaskId(taskId: string, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    this.logger.log(`Fetching evidence list for task ${taskId}`);

    try {
      const query: any = {
        tenantId,
        taskId,
        page: 1,
        limit: 100,
      };

      if (role === 'CMS_INVESTIGATOR') {
        query.uploadedBy = userId;
      } else if (role === 'CMS_AUDITOR' || role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
      } else {
        throw new UnauthorizedException('Invalid role');
      }

      const result = await this.couchdb.queryDocuments(query);
      const docs = result.data || [];

      const evidence: EvidenceResponseDto[] = docs.map((item) => ({
        id: item.evidenceId,
        taskId: item.taskId,
        fileName: item.fileName,
        originalName: item.originalName,
        type: item.type,
        fileSize: Number(item.fileSize),
        mimeType: item.mimeType,
        hash: item.hash,
        uploadedBy: item.uploadedBy,
        uploadedAt: item.uploadedAt,
        tags: item.tags,
        description: item.description,
        comments: item.comments,
        filePath: '',
        downloadUrl: `/api/evidenceDoc/${item.evidenceId}/download`,
        verified: true,
      }));

      await this.auditLog.logAction({
        userId,
        operation: 'view',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_LIST_VIEWED',
        outcome: 'SUCCESS',
      });

      return {
        evidence,
        total: evidence.length,
        taskId,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch evidence');
    }
  }

  async getEvidenceById(evidenceId: string, userId: string, tenantId: string, userRole: string): Promise<EvidenceResponseDto> {
    this.logger.log(`Fetching evidence ${evidenceId}`);

    let query: any = {
      tenantId,
      evidenceId,
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
      type: evidenceDoc.type,
      fileSize: Number(evidenceDoc.fileSize),
      mimeType: evidenceDoc.mimeType,
      hash: evidenceDoc.hash,
      uploadedBy: evidenceDoc.uploadedBy,
      uploadedAt: evidenceDoc.uploadedAt,
      tags: evidenceDoc.tags,
      description: evidenceDoc.description,
      comments: evidenceDoc.comments,
      filePath: '',
      downloadUrl: `/api/evidenceDoc/${evidenceDoc.evidenceId}/download`,
      verified: true,
    };
  }

  async downloadEvidence(
    evidenceId: string,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ file: Buffer; metadata: EvidenceResponseDto }> {
    this.logger.log(`Downloading evidence ${evidenceId}`);

    const query: any = {
      tenantId,
      evidenceId,
      page: 1,
      limit: 1,
    };

    if (role === 'CMS_INVESTIGATOR') {
      query.uploadedBy = userId;
    } else if (role === 'CMS_AUDITOR' || role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
    } else {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];

    if (!evidenceDoc) {
      throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);
    }

    try {
      const file = await this.couchdb.getAttachment(evidenceId, evidenceDoc.fileName);

      const currentHash = this.calculateHash(file);
      if (currentHash !== evidenceDoc.hash) {
        this.logger.error(`Hash mismatch for ${evidenceId}. Expected: ${evidenceDoc.hash}, Got: ${currentHash}`);
        throw new BadRequestException('Evidence integrity check failed');
      }

      await this.auditLog.logAction({
        userId,
        operation: 'download',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_DOWNLOADED',
        outcome: 'SUCCESS',
      });

      const metadata: EvidenceResponseDto = {
        id: evidenceDoc.evidenceId,
        taskId: evidenceDoc.taskId,
        fileName: evidenceDoc.fileName,
        type: evidenceDoc.type,
        fileSize: Number(evidenceDoc.fileSize),
        mimeType: evidenceDoc.mimeType,
        hash: evidenceDoc.hash,
        uploadedBy: evidenceDoc.uploadedBy,
        uploadedAt: evidenceDoc.uploadedAt,
        tags: evidenceDoc.tags,
        description: evidenceDoc.description,
        comments: evidenceDoc.comments,
        filePath: '',
        downloadUrl: `/api/evidenceDoc/${evidenceDoc.evidenceId}/download`,
        verified: true,
      };

      return { file, metadata };
    } catch (error) {
      this.logger.error(`Failed to download evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to download evidence');
    }
  }

  async verifyEvidence(evidenceId: string, userId: string, tenantId: string, role: string): Promise<VerifyEvidenceDto> {
    this.logger.log(`Verifying evidence ${evidenceId}`);

    const query: any = {
      tenantId,
      evidenceId,
      page: 1,
      limit: 1,
    };

    if (role === 'CMS_INVESTIGATOR') {
      query.uploadedBy = userId;
    } else if (role === 'CMS_AUDITOR' || role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
    } else {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const evidenceDoc = result.data?.[0];

    if (!evidenceDoc) {
      throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);
    }

    try {
      const file = await this.couchdb.getAttachment(evidenceId, evidenceDoc.fileName);

      const currentHash = this.calculateHash(file);
      const verified = currentHash === evidenceDoc.hash;

      console.log("currentHash: ", currentHash);
      console.log("evidenceDoc.hash: ", evidenceDoc.hash);

      await this.auditLog.logAction({
        userId,
        operation: 'verify',
        entityName: 'Evidence',
        actionPerformed: verified ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFICATION_FAILED',
        outcome: verified ? 'SUCCESS' : 'FAILURE',
      });

      return {
        evidenceId: evidenceDoc.evidenceId,
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
}
