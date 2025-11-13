import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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

  /**
   * Calculate SHA-256 hash of file buffer
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Upload evidence file with integrity validation
   */
  async uploadEvidence(file: any, dto: UploadEvidenceDto, userId: string): Promise<EvidenceResponseDto> {
    this.logger.log(`Uploading evidence for case ${dto.caseId} by user ${userId}`);

    try {
      const caseExists = await this.prisma.case.findUnique({
        where: { case_id: dto.caseId },
      });

      if (!caseExists) {
        throw new NotFoundException(`Case ${dto.caseId} not found`);
      }

      const fileHash = this.calculateHash(file.buffer);
      this.logger.log(`File hash calculated: ${fileHash}`);

      // 3. Generate unique document ID
      const docId = `evidence_${dto.caseId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 4. Prepare metadata for CouchDB
      const couchMetadata = {
        _id: docId,
        caseId: dto.caseId,
        fileName: file.originalname,
        type: dto.type,
        fileSize: file.size,
        mimeType: file.mimetype,
        hash: fileHash,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        tags: dto.tags,
        description: dto.description,
        comments: dto.comments,
      };

      await this.couchdb.insertWithAttachment(docId, couchMetadata, file.originalname, file.buffer, file.mimetype);

      this.logger.log(`Evidence stored in CouchDB: ${docId}`);

      const task = await this.prisma.task.findFirst({
        where: { case_id: dto.caseId },
        orderBy: { created_at: 'desc' },
      });

      if (!task) {
        throw new BadRequestException(`No task found for case ${dto.caseId}. Evidence must be linked to a task.`);
      }

      const evidence = await this.prisma.evidence.create({
        data: {
          case_id: dto.caseId,
          task_id: task.task_id,
          uploader_user_id: userId,
          tenant_id: 'default',
          name: file.originalname,
          description: dto.description || '',
          type: dto.type,
          file_path: docId,
          file_size: BigInt(file.size),
          file_type: file.mimetype,
          evidence_hash: fileHash,
          metadata: {
            tags: dto.tags,
            comments: dto.comments,
            couchdbDocId: docId,
          },
        },
      });

      this.logger.log(`Evidence metadata stored in PostgreSQL: ${evidence.evidence_id}`);

      await this.auditLog.logAction({
        userId,
        operation: 'upload',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_UPLOADED',
        outcome: 'SUCCESS',
      });

      return {
        id: evidence.evidence_id,
        caseId: evidence.case_id || dto.caseId,
        fileName: evidence.name,
        originalName: file.originalname,
        type: dto.type,
        fileSize: Number(evidence.file_size),
        mimeType: evidence.file_type || file.mimetype,
        hash: evidence.evidence_hash,
        uploadedBy: evidence.uploader_user_id,
        uploadedAt: evidence.uploaded_at,
        tags: dto.tags,
        description: dto.description,
        comments: dto.comments,
        couchdbDocId: docId,
        downloadUrl: `/api/evidence/${evidence.evidence_id}/download`,
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

  /**
   * Get list of evidence for a case
   */
  async getEvidenceByCase(caseId: string, userId: string): Promise<EvidenceListResponseDto> {
    this.logger.log(`Fetching evidence for case ${caseId}`);

    try {
      const evidenceList = await this.prisma.evidence.findMany({
        where: { case_id: caseId },
        orderBy: { uploaded_at: 'desc' },
      });

      const evidence: EvidenceResponseDto[] = evidenceList.map((item) => ({
        id: item.evidence_id,
        caseId: item.case_id || caseId,
        fileName: item.name,
        originalName: item.name,
        type: (item.type as EvidenceType) || EvidenceType.OTHER,
        fileSize: Number(item.file_size),
        mimeType: item.file_type || 'application/octet-stream',
        hash: item.evidence_hash,
        uploadedBy: item.uploader_user_id,
        uploadedAt: item.uploaded_at,
        tags: (item.metadata as any)?.tags,
        description: item.description,
        comments: (item.metadata as any)?.comments,
        couchdbDocId: item.file_path,
        downloadUrl: `/api/evidence/${item.evidence_id}/download`,
      }));

      // Log audit trail
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
        caseId,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch evidence');
    }
  }

  /**
   * Get single evidence by ID
   */
  async getEvidenceById(evidenceId: string, userId: string): Promise<EvidenceResponseDto> {
    this.logger.log(`Fetching evidence ${evidenceId}`);

    const evidence = await this.prisma.evidence.findUnique({
      where: { evidence_id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }

    // Log audit trail
    await this.auditLog.logAction({
      userId,
      operation: 'view',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_VIEWED',
      outcome: 'SUCCESS',
    });

    return {
      id: evidence.evidence_id,
      caseId: evidence.case_id || 'unknown',
      fileName: evidence.name,
      originalName: evidence.name,
      type: (evidence.type as EvidenceType) || EvidenceType.OTHER,
      fileSize: Number(evidence.file_size),
      mimeType: evidence.file_type || 'application/octet-stream',
      hash: evidence.evidence_hash,
      uploadedBy: evidence.uploader_user_id,
      uploadedAt: evidence.uploaded_at,
      tags: (evidence.metadata as any)?.tags,
      description: evidence.description,
      comments: (evidence.metadata as any)?.comments,
      couchdbDocId: evidence.file_path,
      downloadUrl: `/api/evidence/${evidence.evidence_id}/download`,
    };
  }

  /**
   * Download evidence file
   */
  async downloadEvidence(evidenceId: string, userId: string): Promise<{ file: Buffer; metadata: EvidenceResponseDto }> {
    this.logger.log(`Downloading evidence ${evidenceId}`);

    // Get metadata from PostgreSQL
    const evidence = await this.prisma.evidence.findUnique({
      where: { evidence_id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }

    try {
      // Get file from CouchDB
      const couchdbDocId = evidence.file_path;
      const file = await this.couchdb.getAttachment(couchdbDocId, evidence.name);

      // Verify hash integrity
      const currentHash = this.calculateHash(file);
      if (currentHash !== evidence.evidence_hash) {
        this.logger.error(`Hash mismatch for evidence ${evidenceId}. Expected: ${evidence.evidence_hash}, Got: ${currentHash}`);
        throw new BadRequestException('Evidence integrity check failed');
      }

      // Log audit trail
      await this.auditLog.logAction({
        userId,
        operation: 'download',
        entityName: 'Evidence',
        actionPerformed: 'EVIDENCE_DOWNLOADED',
        outcome: 'SUCCESS',
      });

      const metadata: EvidenceResponseDto = {
        id: evidence.evidence_id,
        caseId: evidence.case_id || 'unknown',
        fileName: evidence.name,
        originalName: evidence.name,
        type: (evidence.type as EvidenceType) || EvidenceType.OTHER,
        fileSize: Number(evidence.file_size),
        mimeType: evidence.file_type || 'application/octet-stream',
        hash: evidence.evidence_hash,
        uploadedBy: evidence.uploader_user_id,
        uploadedAt: evidence.uploaded_at,
        tags: (evidence.metadata as any)?.tags,
        description: evidence.description,
        comments: (evidence.metadata as any)?.comments,
        couchdbDocId: couchdbDocId,
        downloadUrl: `/api/evidence/${evidence.evidence_id}/download`,
        verified: true,
      };

      return { file, metadata };
    } catch (error) {
      this.logger.error(`Failed to download evidence: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to download evidence');
    }
  }

  async verifyEvidence(evidenceId: string, userId: string): Promise<VerifyEvidenceDto> {
    this.logger.log(`Verifying evidence ${evidenceId}`);

    const evidence = await this.prisma.evidence.findUnique({
      where: { evidence_id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }

    try {
      const file = await this.couchdb.getAttachment(evidence.file_path, evidence.name);

      const currentHash = this.calculateHash(file);
      const verified = currentHash === evidence.evidence_hash;

      await this.auditLog.logAction({
        userId,
        operation: 'verify',
        entityName: 'Evidence',
        actionPerformed: verified ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFICATION_FAILED',
        outcome: verified ? 'SUCCESS' : 'FAILURE',
      });

      return {
        evidenceId: evidence.evidence_id,
        expectedHash: evidence.evidence_hash,
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

  async searchByHash(hash: string, userId: string): Promise<EvidenceResponseDto[]> {
    this.logger.log(`Searching evidence by hash: ${hash}`);

    const evidenceList = await this.prisma.evidence.findMany({
      where: { evidence_hash: hash },
    });

    await this.auditLog.logAction({
      userId,
      operation: 'search',
      entityName: 'Evidence',
      actionPerformed: 'EVIDENCE_SEARCH_BY_HASH',
      outcome: 'SUCCESS',
    });

    return evidenceList.map((evidence) => ({
      id: evidence.evidence_id,
      caseId: evidence.case_id || 'unknown',
      fileName: evidence.name,
      originalName: evidence.name,
      type: (evidence.type as EvidenceType) || EvidenceType.OTHER,
      fileSize: Number(evidence.file_size),
      mimeType: evidence.file_type || 'application/octet-stream',
      hash: evidence.evidence_hash,
      uploadedBy: evidence.uploader_user_id,
      uploadedAt: evidence.uploaded_at,
      tags: (evidence.metadata as any)?.tags,
      description: evidence.description,
      comments: (evidence.metadata as any)?.comments,
      couchdbDocId: evidence.file_path,
      downloadUrl: `/api/evidence/${evidence.evidence_id}/download`,
    }));
  }
}
