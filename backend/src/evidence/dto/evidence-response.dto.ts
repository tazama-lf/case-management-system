import { ApiProperty } from '@nestjs/swagger';
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
  attachments: any [];

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
  couchdbRev?: string;
}

export class EvidenceListResponseDto {
  @ApiProperty({ type: [EvidenceResponseDto] })
  evidence: EvidenceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  taskId?: string;
  
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
