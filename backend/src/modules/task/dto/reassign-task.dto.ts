import { IsString, IsNotEmpty, IsOptional, MaxLength, IsNumber } from 'class-validator';
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
    example: 42,
  })
  @IsNumber()
  @IsOptional()
  targetWorkQueueId?: number;

  @ApiPropertyOptional({
    description: 'Optional reason for task reassignment',
    example: 'Workload balancing',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: 'Update note explaining the changes',
    example: 'Updated priority based on additional investigation',
    type: 'string',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  note: string;
}
