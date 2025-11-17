import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReassignTaskDto {
  @ApiProperty({
    description: 'UUID of the user to reassign the task to',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty({ message: 'assignedUserId is required' })
  assignedUserId: string;

  @ApiPropertyOptional({
    description: 'UUID of the target work queue for reassignment',
    example: '1e8d70a0-8e5c-42c5-bee2-60447fb7030g',
    format: 'uuid',
  })
  @IsString()
  @IsOptional()
  targetWorkQueueId?: string;

  @ApiPropertyOptional({
    description: 'Optional reason for task reassignment',
    example: 'Workload balancing',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
