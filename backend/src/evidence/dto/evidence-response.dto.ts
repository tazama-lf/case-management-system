import { ApiProperty } from '@nestjs/swagger';
import { EvidenceType } from './upload-evidence.dto';

export class EvidenceMetadataDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  caseId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty({ enum: EvidenceType })
  type: EvidenceType;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  hash: string;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty({ required: false })
  tags?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  comments?: string;

  @ApiProperty()
  couchdbDocId: string;

  @ApiProperty()
  couchdbRev?: string;
}

export class EvidenceResponseDto extends EvidenceMetadataDto {
  @ApiProperty({ description: 'URL to download the evidence' })
  downloadUrl: string;

  @ApiProperty({ description: 'Verification status of the hash' })
  verified?: boolean;
}

export class EvidenceListResponseDto {
  @ApiProperty({ type: [EvidenceResponseDto] })
  evidence: EvidenceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  caseId: string;
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
