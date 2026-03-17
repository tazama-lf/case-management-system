import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto, EvidenceType, CreateEvidenceDto } from './dto';
import { PrismaService } from 'prisma/prisma.service';
import { CouchdbService } from '../couchdb/couchdb.service';
import { EvidenceRepository } from '../repository/evidence.repository';
import { TaskRepository } from '../repository/task.repository';
import { EventLogService } from 'src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../task_history/taskHistory.service';
import { RbacService, EndpointKey } from 'src/utils/rbac/rbacHelper';
import type { AuthenticatedUser } from 'src/utils/types/auth.types';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  private readonly rbacService = new RbacService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly couchdb: CouchdbService,
    private readonly evidenceRepository: EvidenceRepository,
    private readonly taskRepository: TaskRepository,
    private readonly eventLogSerice: EventLogService,
    private readonly taskHistoryService: TaskHistoryService,
  ) {}

  private sha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private encrypt(buffer: Buffer): {
    encrypted: Buffer;
    key: string;
    iv: string;
    authTag: string;
  } {
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

  private decrypt(enc: Buffer, key: string, iv: string, tag: string): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));

    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  async uploadEvidence(
    files: any[],
    dto: UploadEvidenceDto,
    userId: string,
    tenantId: string,
    user?: AuthenticatedUser,
    endpointKey?: EndpointKey,
  ): Promise<EvidenceResponseDto> {
    const allowedMimeTypes: Record<string, string[]> = {
      KYC: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
      EDD: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
      ADVERSE_MEDIA: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
      SANCTIONS: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
      SAR_STR_FILING: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
      OTHER: [
        'audio/mpeg',
        'text/css',
        'application/json',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/epub+zip',
        'text/html',
        'image/png',
        'image/jpeg',
        'image/tiff',
      ],
    };

    const maxFilesPerSection: Record<string, number> = {
      KYC: 5,
      EDD: 5,
      SANCTIONS: 5,
      ADVERSE_MEDIA: 5,
      OTHER: 10,
    };

    const maxSize = 50 * 1024 * 1024; // 50MB
    const sectionKey = dto.evidenceType.toUpperCase();

    // Check if the number of files in this upload exceeds max allowed
    if (files.length > maxFilesPerSection[sectionKey]) {
      throw new BadRequestException(
        `Cannot attach files. Maximum ${maxFilesPerSection[sectionKey]} files allowed for section ${dto.evidenceType}`,
      );
    }

    for (const file of files) {
      // Validate MIME type
      const allowed = allowedMimeTypes[dto.evidenceType];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not allowed for ${dto.evidenceType} evidence. File: ${file.originalname}`,
        );
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new BadRequestException(`File exceeds 50MB: ${file.originalname}`);
      }
    }

    const task = await this.prisma.task.findUnique({ where: { task_id: dto.taskId } });
    if (!task) throw new NotFoundException(`Task ${dto.taskId} not found`);

    const taskWithCase = await this.taskRepository.findTaskWithCase(dto.taskId, tenantId);
    this.logger.log(`Uploading evidence for task ${dto.taskId} taskWithCase ${JSON.stringify(taskWithCase)}`);

    if (user && endpointKey && taskWithCase?.case) {
      const rbacRole = this.rbacService.getRoleFromUser(user);
      if (!rbacRole) throw new ForbiddenException('Unrecognised CMS role');
      const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: taskWithCase.case.status });
      if (!t2.allowed) throw new ForbiddenException(t2.reason);
    }

    const evidenceId = `ev_${dto.taskId}_${Date.now()}`;

    const metadata: any = {
      _id: evidenceId,
      evidenceId,
      tenantId,
      taskId: dto.taskId,
      caseId: task.case_id,
      uploadedBy: userId,
      uploadedAt: new Date(),
      evidenceType: dto.evidenceType,
      tags: dto.tags,
      description: dto.description,
      comments: dto.comments,
      archive: false,
      metadata: [],
    };

    if (dto.evidenceType === EvidenceType.ADVERSE_MEDIA) {
      metadata.aggregator = dto.aggregator;
      metadata.dateSearched = dto.dateSearched;
      metadata.keywords = dto.keywords;
      metadata.findings = dto.findings;
    }

    if (dto.evidenceType === EvidenceType.SANCTIONS) {
      metadata.screeningDate = dto.screeningDate;
      metadata.tool = dto.tool;
      metadata.summaryDisposition = dto.summaryDisposition;
    }

    const insertResult = await this.couchdb.insertDocument(evidenceId, metadata);
    let currentRev = insertResult.rev;

    for (const file of files) {
      const { encrypted, key, iv, authTag } = this.encrypt(file.buffer);
      const hash = this.sha256(encrypted);

      // eslint-disable-next-line no-await-in-loop -- CouchDB requires sequential attachment uploads with updated revision
      const attachmentResult = await this.couchdb.insertAttachment(evidenceId, currentRev, file.originalname, encrypted, file.mimetype);

      metadata.metadata.push({
        fileName: file.originalname,
        fileSize: file.size,
        filePath: attachmentResult.filePath,
        mimeType: file.mimetype,
        hash,
        encryption: { key, iv, authTag },
      });

      currentRev = attachmentResult.rev;

      const createEvidenceDto: CreateEvidenceDto = {
        id: evidenceId,
        taskId: dto.taskId,
        fileName: file.originalname,
        description: dto.description,
        evidenceType: dto.evidenceType,
        file_path: attachmentResult.filePath,
        hash,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: metadata.uploadedAt,
        uploadedBy: userId,
        caseId: task.case_id,
        tenant_id: tenantId,
        metadata,
      };

      this.evidenceRepository.createEvidence(userId, createEvidenceDto);
    }
    await this.couchdb.updateDocument(evidenceId, metadata);

    await this.eventLogSerice.logEventAction({
      userId,
      operation: 'upload',
      entityName: 'Evidence',
      actionPerformed: `EVIDENCE_UPLOADED for Case ${task.case_id} and Task ${dto.taskId}`,
      outcome: 'SUCCESS',
    });

    await this.taskHistoryService.logTaskHistoryAction({
      userId,
      operation: 'upload Evidence',
      entityName: 'Evidence',
      actionPerformed: `EVIDENCE_UPLOADED for Case ${task.case_id} and Task ${dto.taskId}`,
      case_id: task.case_id,
      task_id: dto.taskId,
      tenant_id: tenantId,
    });

    return metadata;
  }

  async deleteEvidence(
    evidenceId: string,
    fileName: string,
    userId: string,
    tenantId: string,
    user?: AuthenticatedUser,
    endpointKey?: EndpointKey,
  ): Promise<EvidenceResponseDto> {
    if (evidenceId.trim() === '' || fileName.trim() === '') {
      this.logger.log(`Evidence Id  ${evidenceId} or fileName  ${fileName} is not found`);
      this.logger.error(`Evidence Id or fileName is not found: ${evidenceId} , ${fileName}`);
      throw new BadRequestException(`Evidence Id is not found: ${evidenceId}, or fileName is empty: ${fileName}`);
    }
    this.logger.log(`Deleting evidence ${evidenceId}`);

    const doc = await this.couchdb.getDocument(evidenceId);
    this.logger.log(`Fetched document for evidence ${evidenceId}: ${JSON.stringify(doc)}`);

    if (user && endpointKey && doc?.caseId) {
      const caseRecord = await this.prisma.case.findUnique({ where: { case_id: doc.caseId } });
      if (caseRecord) {
        const rbacRole = this.rbacService.getRoleFromUser(user);
        if (!rbacRole) throw new ForbiddenException('Unrecognised CMS role');
        const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: caseRecord.status });
        if (!t2.allowed) throw new ForbiddenException(t2.reason);
      }
    }

    if (!doc) {
      this.logger.error(`Evidence ${evidenceId} not found`);
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }

    try {
      this.logger.log(`Deleting attachment ${fileName} from evidence ${doc._id} and revision ${doc._rev}`);
      const deleteResult = await this.couchdb.deleteEvidence(doc._id, decodeURIComponent(fileName), doc._rev);
      this.logger.log(`Attachment deletion result: ${JSON.stringify(deleteResult)}`);

      await this.evidenceRepository.deleteEvidenceById(evidenceId, tenantId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete evidence: ${errorMessage}`, errorStack);
      throw error;
    }
    return doc;
  }

  async getEvidenceById(evidenceId: string, userId: string, tenantId: string, userRole: string): Promise<EvidenceResponseDto> {
    const query: any = {
      tenantId,
      evidenceId,
      archive: false,
      page: 1,
      limit: 1,
    };

    if (userRole === 'CMS_INVESTIGATOR') {
      query.uploadedBy = userId;
    } else if (userRole === 'CMS_AUDITOR' || userRole === 'CMS_SUPERVISOR' || userRole === 'CMS_COMPLIANCE_OFFICER') {
      //doNothing
    } else {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const [evidenceDoc] = result.data;

    if (!evidenceDoc) {
      throw new ForbiddenException('Access denied or evidence not found');
    }

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
      attachments: evidenceDoc.metadata,
      archive: evidenceDoc.archive,
    };
  }

  async downloadEvidence(
    evidenceId: string,
    userId: string,
    tenantId: string,
    role: string,
    attachmentName?: string,
  ): Promise<{ files: Array<{ file: Buffer; attachmentMeta: any }>; metadata: EvidenceResponseDto }> {
    this.logger.log(`Downloading evidence ${evidenceId}`);
    let query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (evidenceId.includes('InvestigationReport')) {
      query = { tenantId, reportId: evidenceId, page: 1, limit: 1 };
    }
    // if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }
    const result = await this.couchdb.queryDocuments(query);

    const [evidenceDoc] = result.data;
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    const attachments = evidenceDoc.metadata ?? [];
    if (!attachments.length) throw new NotFoundException('No attachments found for this evidence');

    const targets = attachmentName ? attachments.filter((a) => a.fileName === attachmentName) : attachments;

    if (!targets.length) throw new NotFoundException('Requested attachment not found');

    const files: Array<{ file: Buffer; attachmentMeta: any }> = [];

    try {
      const downloadPromises = targets.map(async (att) => {
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

        return {
          file,
          attachmentMeta: {
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            hash: att.hash,
            encryption: att.encryption,
            filePath: att.filePath,
          },
        };
      });

      files.push(...(await Promise.all(downloadPromises)));

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
          attachments: evidenceDoc.metadata,
          fileName: evidenceDoc.fileName,
          fileSize: evidenceDoc.metadata[0].fileSize,
          mimeType: evidenceDoc.metadata[0].mimeType,
          hash: evidenceDoc.metadata[0].hash,
          archive: evidenceDoc.archive,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to download evidence: ${errorMessage}`, errorStack);
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
    const [evidenceDoc] = result.data;
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);

    const attachments = evidenceDoc.metadata ?? [];
    if (!attachments.length) throw new NotFoundException('No attachments found for this evidence');

    const targets = attachmentName ? attachments.filter((a) => a.fileName === attachmentName) : attachments;

    if (!targets.length) throw new NotFoundException('Requested attachment not found');

    const details: any[] = [];

    try {
      const verifyPromises = targets.map(async (att) => {
        const encryptedRaw = await this.couchdb.getAttachment(evidenceId, att.fileName);
        const encryptedBuffer: Buffer = Buffer.isBuffer(encryptedRaw) ? encryptedRaw : Buffer.from(encryptedRaw);

        const encryptedHash = this.sha256(encryptedBuffer);
        if (encryptedHash !== att.hash) {
          return {
            fileName: att.fileName,
            verified: false,
            reason: 'encrypted hash mismatch',
            expectedHash: att.hash,
            actualHash: encryptedHash,
          };
        }

        // try {
        //   let decrypted: Buffer;
        //   decrypted = this.decrypt(encryptedBuffer, att.encryption.key, att.encryption.iv, att.encryption.authTag);
        // } catch (decErr) {
        //   const errorMessage = decErr instanceof Error ? decErr.message : String(decErr);
        //   const errorStack = decErr instanceof Error ? decErr.stack : undefined;
        //   this.logger.error(`Decryption failed for ${evidenceId}:${att.fileName} - ${errorMessage}`, errorStack);
        //   return {
        //     fileName: att.fileName,
        //     verified: false,
        //     reason: 'decryption failed',
        //     error: errorMessage,
        //   };
        // }

        return {
          fileName: att.fileName,
          verified: true,
          reason: 'ok',
          expectedEncryptedHash: att.hash,
          encryptedHash,
        };
      });

      const verificationResults = await Promise.all(verifyPromises);
      details.push(...verificationResults);
      const allVerified = verificationResults.every((result) => result.verified);

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to verify evidence: ${errorMessage}`, errorStack);
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Failed to verify evidence');
    }
  }

  async getEvidenceByTaskId(taskId: number, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const query: any = { taskId, archive: false, page: 1, limit: 100 };
    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const docs = result.data;

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
      attachments: item.metadata,
      archive: item.archive,
    }));

    return { evidence, total: evidence.length, taskId };
  }

  async getEvidenceByCaseId(caseId: number, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const allDocs: any[] = [];

    const query: any = { caseId, page: 1, limit: 100 };

    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }
    this.logger.log(`role=${role}`);

    const result = await this.couchdb.queryDocuments(query);

    const docs = result.data;
    allDocs.push(...docs);

    const evidence = allDocs.map((item) => ({
      id: item.evidenceId,
      reportId: item.reportId,
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
      attachments: item.metadata,
      archive: item.archive,
    }));

    return { evidence, total: evidence.length };
  }

  async getEvidenceByType(evidenceType: EvidenceType, userId: string, tenantId: string, role: string): Promise<EvidenceListResponseDto> {
    const query: any = { tenantId, evidenceType, archive: false, page: 1, limit: 100 };
    if (role === 'CMS_INVESTIGATOR') query.uploadedBy = userId;
    else if (!['CMS_AUDITOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(role)) throw new UnauthorizedException('Invalid role');

    const result = await this.couchdb.queryDocuments(query);
    const docs = result.data;

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
      attachments: item.metadata,
      archive: item.archive,
    }));

    return { evidence, total: evidence.length, evidenceType };
  }
}
