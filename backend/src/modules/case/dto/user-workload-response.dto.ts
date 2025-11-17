import { ApiProperty } from '@nestjs/swagger';

class OldestCase {
  @ApiProperty({ type: 'string' })
  case_id: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'number' })
  days_old: number;
}

export class UserWorkloadResponseDto {
  @ApiProperty({ type: 'number', example: 15 })
  totalActiveCases: number;

  @ApiProperty({ type: 'number', example: 8 })
  totalPendingTasks: number;

  @ApiProperty({ 
    example: {
      STATUS_20_IN_PROGRESS: 10,
      STATUS_02_READY_FOR_ASSIGNMENT: 5,
    }
  })
  casesByStatus: Record<string, number>;

  @ApiProperty({ 
    example: {
      CRITICAL: 2,
      URGENT: 5,
      NEW: 8,
    }
  })
  casesByPriority: Record<string, number>;

  @ApiProperty({ type: OldestCase })
  oldestCase: OldestCase;

  @ApiProperty({ type: 'number', example: 5.5 })
  averageCaseAge: number;
}
