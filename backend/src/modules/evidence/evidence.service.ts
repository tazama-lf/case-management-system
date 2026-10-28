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
import { setTimeout as sleep } from 'node:timers/promises';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto, EvidenceType, CreateEvidenceDto } from './dto';
import { PrismaService } from 'prisma/prisma.service';
import { CouchdbService, EVIDENCE_STATUS, QueryDocumentsParams } from '../couchdb/couchdb.service';
import { EvidenceRepository } from '../repository/evidence.repository';
import { TaskRepository } from '../repository/task.repository';
import { EventLogService } from 'src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../task_history/taskHistory.service';
import { RbacService, EndpointKey } from 'src/utils/rbac/rbacHelper';
import type { AuthenticatedUser } from 'src/utils/types/auth.types';
import { CaseInvestigatorService } from '../case-investigator/case-investigator.service';

// How many times removing a half-written CouchDB document, or marking a committed one, is tried; retries back off 1s, 2s, ...
const CLEANUP_ATTEMPTS = 3;

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
    private readonly caseInvestigatorService: CaseInvestigatorService,
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
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
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

    if (!taskWithCase?.case) {
      throw new ForbiddenException('Cannot verify case status: task has no associated case');
    }
    const rbacRole = this.rbacService.getRoleFromUser(user);
    const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: taskWithCase.case.status });
    if (!t2.allowed) throw new ForbiddenException(t2.reason);
    await this.caseInvestigatorService.assertReadAccess(task.case_id, userId, tenantId, rbacRole);

    // Two files with the same name therefore never collide: each has its own document.
    const documents: any[] = [];

    // Everything from here on must land in both stores or in neither: a failure removes every CouchDB document
    // created by this request and rolls the Postgres rows back, then the error reaches the client.
    try {
      for (const file of files) {
        // ev_<task>_<ms>_<random>: the random part keeps ids unique when several files (or parallel requests for
        // the same task) land in the same millisecond. Nothing reads the parts of an id back.
        const evidenceId = `ev_${dto.taskId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

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
          // Invisible to readers until the Postgres rows are written; see EVIDENCE_STATUS.
          status: EVIDENCE_STATUS.PENDING,
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

        const { encrypted, key, iv, authTag } = this.encrypt(file.buffer);
        const hash = this.sha256(encrypted);

        // eslint-disable-next-line no-await-in-loop -- documents are created one at a time so a failure can undo exactly what exists
        const insertResult = await this.couchdb.insertDocument(evidenceId, metadata);
        documents.push(metadata);

        // eslint-disable-next-line no-await-in-loop -- the attachment needs the revision returned by the insert above
        const attachmentResult = await this.couchdb.insertAttachment(
          evidenceId,
          insertResult.rev,
          file.originalname,
          encrypted,
          file.mimetype,
        );

        metadata.metadata.push({
          fileName: file.originalname,
          fileSize: file.size,
          filePath: attachmentResult.filePath,
          mimeType: file.mimetype,
          hash,
          encryption: { key, iv, authTag },
        });
      }

      // All rows go in one transaction (only Postgres work in it, so it never holds a connection across a CouchDB
      // call). The CouchDB documents stay pending until it has committed.
      await this.prisma.$transaction(async (tx) => {
        for (const metadata of documents) {
          // What the row records; the CouchDB document is only flipped once this transaction has committed.
          metadata.status = EVIDENCE_STATUS.COMMITTED;
          const [file] = metadata.metadata;
          const createEvidenceDto: CreateEvidenceDto = {
            id: metadata.evidenceId,
            taskId: dto.taskId,
            fileName: file.fileName,
            description: dto.description,
            evidenceType: dto.evidenceType,
            file_path: file.filePath,
            hash: file.hash,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            uploadedAt: metadata.uploadedAt,
            uploadedBy: userId,
            caseId: task.case_id,
            tenant_id: tenantId,
            metadata,
          };
          // eslint-disable-next-line no-await-in-loop -- rows are written sequentially inside one transaction
          await this.evidenceRepository.createEvidence(userId, createEvidenceDto, tx);
        }
      });
    } catch (error) {
      await Promise.all(
        documents.map(async (doc) => {
          await this.removeCouchDocument(doc);
        }),
      );
      throw error;
    }

    // The upload has committed in Postgres from here on, so nothing below may delete anything.
    await Promise.all(
      documents.map(async (doc) => {
        await this.markCommitted(doc);
      }),
    );

    await this.recordUploadAudit(userId, tenantId, task.case_id, dto.taskId);

    // The first document keeps the response shape the UI relies on (it sends one file per request); `documents` lists
    // every document this request created, for callers that send several files at once.
    return { ...documents[0], documents };
  }

  /**
   * Event-log and task-history entries for a finished upload. Best effort: the evidence is already stored in both
   * databases, so a failure to write either entry is logged and must not turn the upload into an error.
   */
  private async recordUploadAudit(userId: string, tenantId: string, caseId: number, taskId: number): Promise<void> {
    const actionPerformed = `EVIDENCE_UPLOADED for Case ${caseId} and Task ${taskId}`;

    const results = await Promise.allSettled([
      this.eventLogSerice.logEventAction({
        userId,
        tenantId,
        operation: 'upload',
        entityName: 'Evidence',
        actionPerformed,
        outcome: 'SUCCESS',
      }),
      this.taskHistoryService.logTaskHistoryAction({
        userId,
        operation: 'upload Evidence',
        entityName: 'Evidence',
        actionPerformed,
        case_id: caseId,
        task_id: taskId,
        tenant_id: tenantId,
      }),
    ]);

    const entries = ['event log', 'task history'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Failed to write ${entries[index]} entry for evidence upload on task ${taskId}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      }
    });
  }

  /**
   * Marks a document `committed` in CouchDB once its upload has committed in Postgres, retrying a few times. Best
   * effort and never deletes anything: if it still fails, the document stays pending (hidden) and the reconciliation
   * job promotes it, since its Postgres row exists.
   */
  private async markCommitted(doc: any): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop -- each attempt depends on the previous one failing
        await this.couchdb.updateDocument(doc.evidenceId, doc);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < CLEANUP_ATTEMPTS) {
          // eslint-disable-next-line no-await-in-loop -- back off before the next attempt
          await sleep(1000 * attempt);
        }
      }
    }

    this.logger.error(
      `Evidence document ${doc.evidenceId} was saved but could not be marked committed after ${CLEANUP_ATTEMPTS} attempts; it stays hidden until the reconciliation job promotes it: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  /**
   * Removes a half-written CouchDB evidence document, retrying a few times; never masks the error being handled.
   * If it still can't be removed, the document may be orphaned, so that is logged and also recorded as a FAILURE
   * event-log entry, where someone can find it.
   */
  private async removeCouchDocument(doc: any): Promise<void> {
    const evidenceId: string = doc.evidenceId;
    let lastError: unknown;

    for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop -- each attempt depends on the previous one failing
        const current = await this.couchdb.getDocument(evidenceId);
        // eslint-disable-next-line no-await-in-loop -- needs the revision fetched above
        await this.couchdb.deleteDocument(evidenceId, current._rev);
        return;
      } catch (error) {
        // Already gone: nothing left to clean up.
        if ((error as { statusCode?: number }).statusCode === 404) return;
        lastError = error;
        if (attempt < CLEANUP_ATTEMPTS) {
          // eslint-disable-next-line no-await-in-loop -- back off before the next attempt
          await sleep(1000 * attempt);
        }
      }
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    this.logger.error(
      `Failed to clean up CouchDB document ${evidenceId} after ${CLEANUP_ATTEMPTS} attempts after a failed upload; it may be orphaned: ${reason}`,
    );
    try {
      await this.eventLogSerice.logEventAction({
        userId: doc.uploadedBy,
        tenantId: doc.tenantId,
        operation: 'upload cleanup',
        entityName: 'Evidence',
        actionPerformed: `Orphaned CouchDB evidence document ${evidenceId} (Case ${doc.caseId}, Task ${doc.taskId}) could not be removed after a failed upload: ${reason}`,
        outcome: 'FAILURE',
      });
    } catch (auditError) {
      this.logger.error(
        `Could not record orphaned evidence document ${evidenceId} in the event log: ${auditError instanceof Error ? auditError.message : String(auditError)}`,
      );
    }
  }

  async deleteEvidence(
    evidenceId: string,
    fileName: string,
    userId: string,
    tenantId: string,
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
  ): Promise<EvidenceResponseDto> {
    if (evidenceId.trim() === '' || fileName.trim() === '') {
      this.logger.log(`Evidence Id  ${evidenceId} or fileName  ${fileName} is not found`);
      this.logger.error(`Evidence Id or fileName is not found: ${evidenceId} , ${fileName}`);
      throw new BadRequestException(`Evidence Id is not found: ${evidenceId}, or fileName is empty: ${fileName}`);
    }
    this.logger.log(`Deleting evidence ${evidenceId}`);

    const doc = await this.couchdb.getDocument(evidenceId);
    this.logger.log(`Fetched document for evidence ${evidenceId}: ${JSON.stringify(doc)}`);

    if (!doc || doc.status === EVIDENCE_STATUS.PENDING) {
      this.logger.error(`Evidence ${evidenceId} not found`);
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }

    const caseRecord = await this.prisma.case.findUnique({ where: { case_id: doc.caseId } });
    if (caseRecord?.tenant_id !== tenantId || doc.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot verify case status: associated case not found');
    }
    const rbacRoleDelete = this.rbacService.getRoleFromUser(user);
    const t2Delete = this.rbacService.checkTier2({ role: rbacRoleDelete, endpointKey, currentStatus: caseRecord.status });
    if (!t2Delete.allowed) throw new ForbiddenException(t2Delete.reason);
    await this.caseInvestigatorService.assertReadAccess(doc.caseId, userId, tenantId, rbacRoleDelete);

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

    if (!['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'].includes(userRole)) {
      throw new UnauthorizedException('Invalid role');
    }

    const result = await this.couchdb.queryDocuments(query);
    const [evidenceDoc] = result.data;

    if (!evidenceDoc) {
      throw new ForbiddenException('Access denied or evidence not found');
    }
    await this.caseInvestigatorService.assertReadAccess(evidenceDoc.caseId, userId, tenantId, userRole);

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
    const query = evidenceId.includes('InvestigationReport')
      ? { tenantId, reportId: evidenceId, page: 1, limit: 1 }
      : { tenantId, evidenceId, archive: false, page: 1, limit: 1 };
    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }
    const result = await this.couchdb.queryDocuments(query);

    const [evidenceDoc] = result.data;
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);
    await this.caseInvestigatorService.assertReadAccess(evidenceDoc.caseId, userId, tenantId, role);

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

    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) throw new UnauthorizedException('Invalid role');
    const query: any = { tenantId, evidenceId, archive: false, page: 1, limit: 1 };

    const result = await this.couchdb.queryDocuments(query);
    const [evidenceDoc] = result.data;
    if (!evidenceDoc) throw new NotFoundException(`Evidence ${evidenceId} not found or access denied`);
    await this.caseInvestigatorService.assertReadAccess(evidenceDoc.caseId, userId, tenantId, role);

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
    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) throw new UnauthorizedException('Invalid role');

    const task = await this.prisma.task.findUnique({ where: { task_id: taskId }, select: { case_id: true } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    await this.caseInvestigatorService.assertReadAccess(task.case_id, userId, tenantId, role);

    const query: QueryDocumentsParams = { taskId, tenantId, archive: false, page: 1, limit: 100 };
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

    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }
    await this.caseInvestigatorService.assertReadAccess(caseId, userId, tenantId, role);
    this.logger.log(`role=${role}`);

    const query: QueryDocumentsParams = { caseId, tenantId, page: 1, limit: 100 };
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
    if (!['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'].includes(role)) throw new UnauthorizedException('Invalid role');

    const query: any = { tenantId, evidenceType, archive: false, page: 1, limit: 100 };
    if (role === 'CMS_INVESTIGATOR') {
      // Same scope as the per-case evidence endpoints (assertReadAccess): cases the investigator is on or created,
      // plus cases still open for claiming, minus any they are blocked on. getAccessibleCaseIds alone left the
      // open-for-claim cases out, so the list was narrower than what the per-case endpoints allow.
      const caseIds = await this.caseInvestigatorService.getCaseIdScope(userId, tenantId, role);
      if (caseIds !== null) {
        if (caseIds.length === 0) {
          return { evidence: [], total: 0, evidenceType };
        }
        query.caseIds = caseIds;
      }
    }

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
