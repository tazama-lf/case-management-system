import { IsOptional, IsEnum, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CaseStatus, Priority, CaseType } from '@prisma/client-cms';

export class GetAllCasesQueryDto {
  @ApiProperty({
    description: 'Filter by case status',
    enum: CaseStatus,
    required: false,
    example: 'STATUS_20_IN_PROGRESS',
  })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiProperty({
    description: 'Filter by priority',
    enum: Priority,
    required: false,
    example: 'URGENT',
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Filter by SAR/STR task status',
    enum: ['STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS', 'STATUS_30_COMPLETED', 'N/A'],
    required: false,
    example: 'STATUS_30_COMPLETED',
  })
  @IsOptional()
  @IsString()
  sarStrStatus?: string;

  @ApiProperty({
    description: 'Filter by case type',
    enum: CaseType,
    required: false,
    example: 'FRAUD',
  })
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @ApiProperty({
    description: 'Filter by case owner user ID',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiProperty({
    description: 'Include unassigned cases only',
    required: false,
    default: false,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unassignedOnly?: boolean = false;

  @ApiProperty({
    description: 'Search term to filter cases by case ID, case type, status, or alert message',
    required: false,
    example: '244',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter cases created after this date',
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiProperty({
    description: 'Filter cases created before this date',
    required: false,
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  createdBefore?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Sort field',
    required: false,
    default: 'created_at',
    enum: ['created_at', 'updated_at', 'priority', 'status'],
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    default: 'desc',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class CaseDetailsDto {
  @ApiProperty({
    description: 'Case ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  case_id: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Case creator user ID',
    example: 'user-123',
  })
  case_creator_user_id: string;

  @ApiProperty({
    description: 'Case owner user ID',
    example: 'user-456',
    required: false,
  })
  case_owner_user_id?: string;

  @ApiProperty({
    description: 'Case status',
    enum: CaseStatus,
    example: 'STATUS_20_IN_PROGRESS',
  })
  status: CaseStatus;

  @ApiProperty({
    description: 'Case priority',
    enum: Priority,
    example: 'URGENT',
  })
  priority: Priority;

  @ApiProperty({
    description: 'Case type',
    enum: CaseType,
    example: 'FRAUD',
  })
  case_type: CaseType;

  @ApiProperty({
    description: 'Case creation timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Case update timestamp',
    example: '2024-01-15T12:00:00Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'Total number of tasks',
    example: 5,
  })
  total_tasks: number;

  @ApiProperty({
    description: 'Number of completed tasks',
    example: 3,
  })
  completed_tasks: number;

  @ApiProperty({
    description: 'Number of pending tasks',
    example: 2,
  })
  pending_tasks: number;

  @ApiProperty({
    description: 'Alert information if available',
    required: false,
  })
  alert?: {
    alert_id: string;
    message: string;
    confidence_per: number;
    alert_type: string;
  };

  @ApiProperty({
    description: 'Assigned investigator information',
    required: false,
  })
  assigned_to?: {
    user_id: string;
    task_count: number;
  };
}

export class GetAllCasesResponseDto {
  @ApiProperty({
    description: 'List of cases',
    type: [CaseDetailsDto],
  })
  cases: CaseDetailsDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({
    description: 'Overall statistics',
  })
  statistics: {
    totalCases: number;
    casesByStatus: Record<string, number>;
    casesByPriority: Record<string, number>;
    casesByType: Record<string, number>;
    unassignedCases: number;
    averageTasksPerCase: number;
    oldestUnassignedCase?: {
      case_id: string;
      created_at: Date;
      days_old: number;
    };
  };
}
