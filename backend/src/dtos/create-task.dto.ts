import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus } from '@prisma/client-cms';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'UUID of the case to create the task for',
    example: 12345,
  })
  @IsNumber()
  caseId: number;

  @ApiProperty({
    description: 'Investigation notes for the task',
    example: 'Detailed investigation notes entered by investigator.',
    required: false,
  })
  @IsString()
  @IsOptional()
  investigationNotes?: string;
  @ApiProperty({
    description: 'Initial status of the task',
    enum: TaskStatus,
    example: TaskStatus.STATUS_01_UNASSIGNED,
    required: false,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    description: 'UUID of the user to assign the task to (optional)',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assignedUserId?: string;

  @ApiProperty({
    description: 'Name of the task',
    example: 'Verify customer identity documents',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Detailed description of the task',
    example: 'Review and verify the submitted identity documents for compliance',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Candidate group for task routing',
    example: 'investigations',
    enum: ['supervisors', 'investigations', 'analysts'],
    required: false,
  })
  @IsString()
  @IsOptional()
  candidateGroup?: string;
}
