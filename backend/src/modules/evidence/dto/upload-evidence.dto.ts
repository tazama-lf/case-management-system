import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export enum EvidenceType {
  SANCTIONS = 'SANCTIONS',
  ADVERSE_MEDIA = 'ADVERSE_MEDIA',
  OTHER = 'OTHER',
  SAR_STR_FILING = 'SAR_STR_FILING',
  KYC = 'KYC',
  EDD = 'EDD',
}

export class UploadEvidenceDto {
  @ApiProperty({ description: 'Task ID this evidence belongs to' })
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({ description: 'Type of evidence', enum: EvidenceType, example: 'KYC' })
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
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map(k => k.trim());
    return value;
  })
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

  // --- SAR/STR Filing specific ---
  @ApiProperty({ description: 'Date when SAR/STR was submitted to FIU', required: false })
  @IsOptional()
  @IsDateString()
  submissionDate?: string;

  @ApiProperty({ description: 'Reference number from FIU acknowledgment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiProperty({ description: 'Submission channel (Portal/Email/In-Person)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  submissionChannel?: string;
}
