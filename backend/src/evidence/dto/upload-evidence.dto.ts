import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsDateString, IsArray } from 'class-validator';

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

  // --- Adverse Media Screening specific ---
  @ApiProperty({ description: 'Name of the media aggregator or tool', required: false })
  @IsOptional()
  @IsString()
  aggregator?: string;

  @ApiProperty({ description: 'Date when the media search was conducted', required: false })
  @IsOptional()
  @IsDateString()
  dateSearched?: string;

  @ApiProperty({ description: 'Search keywords used', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiProperty({ description: 'Findings or summary of the media search', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string;

   // --- Sanctions Screening specific ---
  @ApiProperty({ description: 'Date when screening was performed', required: false })
  @IsOptional()
  @IsDateString()
  screeningDate?: string;

  @ApiProperty({ description: 'External screening tool or source used', required: false })
  @IsOptional()
  @IsString()
  tool?: string;

  @ApiProperty({ description: 'Summary of screening disposition (Cleared/Escalated/Positive Match)', required: false })
  @IsOptional()
  @IsString()
  summaryDisposition?: string;
}
