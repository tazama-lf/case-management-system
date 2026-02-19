import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  taskId: number;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  reportType: string;

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

