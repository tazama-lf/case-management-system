import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateEvidenceDto, EvidenceResponseDto } from '../evidence/dto/evidence-response.dto';
import { BaseRepository } from './base.repository';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class EvidenceRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async createEvidence(userId: string, createEvidenceDto: CreateEvidenceDto, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return await client.evidence.create({
      data: {
        uploader_user_id: userId,
        tenant_id: createEvidenceDto.tenant_id,
        name: createEvidenceDto.fileName,
        description: createEvidenceDto.description,
        type: createEvidenceDto.evidenceType,
        file_path: createEvidenceDto.file_path,
        evidence_hash: createEvidenceDto.hash,
        uploaded_at: new Date(),
        file_size: createEvidenceDto.fileSize,
        file_type: createEvidenceDto.mimeType,
        metadata: createEvidenceDto.metadata,
        evidence_id: createEvidenceDto.id,
        task_id: createEvidenceDto.taskId,
        case_id: createEvidenceDto.caseId,
      },
    });
  }

  async deleteEvidenceById(evidenceId: string, tenantId: string) {
    return await this.prisma.evidence.delete({
      where: {
        evidence_id: evidenceId,
        tenant_id: tenantId,
      },
    });
  }
}
