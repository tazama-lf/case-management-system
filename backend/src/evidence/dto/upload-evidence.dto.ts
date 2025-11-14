import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  SCREENSHOT = 'SCREENSHOT',
  LOG = 'LOG',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
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
  type: EvidenceType;

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
