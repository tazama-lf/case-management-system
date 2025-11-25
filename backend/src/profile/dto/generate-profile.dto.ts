import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class GenerateProfileDto {
  @ApiProperty({ description: 'Case ID for which to generate the transaction profile' })
  @IsString()
  caseId: string;

  @ApiProperty({ description: 'Filters for transaction profile (date range, channel, transaction type)', required: false, type: Object })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiProperty({ description: 'Investigator interpretation notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
