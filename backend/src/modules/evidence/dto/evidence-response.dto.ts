import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceType } from './upload-evidence.dto';

export class EvidenceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: EvidenceType })
  evidenceType: EvidenceType;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  attachments: any[];

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  hash: string;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty()
  archive: boolean;

  @ApiProperty({ required: false })
  tags?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  comments?: string;

  @ApiProperty()
  couchdbRev?: string;
}

export class EvidenceListResponseDto {
  @ApiProperty({ type: [EvidenceResponseDto] })
  evidence: EvidenceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  taskId?: number;

  @ApiProperty()
  evidenceType?: EvidenceType;
}

export class VerifyEvidenceDto {
  @ApiProperty()
  evidenceId: string;

  @ApiProperty()
  expectedHash: string;

  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  verifiedAt: Date;

  @ApiProperty()
  verifiedBy: string;
}

export class CreateEvidenceDto {
  @ApiProperty({
    description: 'User ID of the uploader',
  })
  uploadedBy: string;

  @ApiProperty({
    description: 'Tenant identifier',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Original file name',
  })
  fileName: string;

  @ApiPropertyOptional({
    description: 'Evidence description',
  })
  description?: string;

  @ApiProperty({
    enum: EvidenceType,
    description: 'Evidence type (e.g. KYC, EDD)',
  })
  evidenceType: EvidenceType;

  @ApiProperty({
    description: 'Stored file path in CouchDB or storage',
  })
  file_path: string;

  @ApiProperty({
    description: 'Hash of the evidence file',
  })
  hash: string;

  @ApiProperty({
    description: 'Upload timestamp',
    type: String,
    format: 'date-time',
  })
  uploadedAt: Date;

  @ApiProperty({
    description: 'File size in bytes',
  })
  fileSize: number;

  @ApiProperty({
    description: 'MIME type of the file',
  })
  mimeType: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the evidence',
    type: Object,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Evidence document ID',
  })
  id: string;

  @ApiProperty({
    description: 'Associated task ID',
  })
  taskId: number;

  @ApiProperty({
    description: 'Associated case ID',
  })
  caseId: number;

}