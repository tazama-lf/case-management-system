import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EvidenceType {
  SANCTIONS = 'SANCTIONS',
  ADVERSE_MEDIA = 'ADVERSE_MEDIA',
  OTHER = 'OTHER',
}

export class UploadEvidenceDto {
  @ApiProperty({ description: 'Task ID this evidence belongs to' })
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({ description: 'Type of evidence', enum: EvidenceType })
  @IsEnum(EvidenceType)
  @IsNotEmpty()
  evidenceType: EvidenceType;

  @ApiProperty({ description: 'Tags for categorization', required: false })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiProperty({ description: 'Description of the evidence', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Comments about the evidence', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
