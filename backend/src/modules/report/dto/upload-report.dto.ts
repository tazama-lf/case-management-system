import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsDateString, IsArray, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UploadReportDto {

  @ApiProperty({ description: 'Case ID this evidence belongs to' })
  @Type(() => Number)
  caseId: string;

  @ApiProperty({ description: 'Type of evidence', example: 'INVESTIGATION_REPORT' })
  @IsOptional()
  reportType: string;

  @ApiProperty({ description: 'Description of the evidence', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Investigators Inputs', required: false })
  @IsString()
  @IsOptional()
  investigatorInputs?: string;

  @ApiProperty({ description: 'Supervisor Remarks', required: false })
  @IsString()
  @IsOptional()
  supervisorRemarks?: string;

  @ApiProperty({ description: 'Recommendation outcome', required: false })
  @IsString()
  @IsOptional()
  outcome?: string;
}
