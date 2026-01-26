import { Injectable } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { CreateEvidenceDto, EvidenceResponseDto } from "../evidence/dto/evidence-response.dto";

@Injectable()
export class EvidenceRepository {
    constructor(private readonly prisma: PrismaService) { }

    async createEvidence(userId: string, createEvidenceDto: CreateEvidenceDto) {
        return await this.prisma.evidence.create({
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

    async deleteEvidenceById(evidenceId: string) {
        return await this.prisma.evidence.delete({
            where: {
                evidence_id: evidenceId,
            },
        });
    }

}