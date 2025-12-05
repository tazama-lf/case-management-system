import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'UUID of the investigator to assign the task to',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
  })
  @IsString({ message: 'assignedUserId must be a string' })
  @IsNotEmpty({ message: 'assignedUserId is required' })
  assignedUserId: string;

  @ApiProperty({
    description: 'Optional comments for the task assignment',
    example: 'Assigning this high-priority case to experienced investigator',
    required: false,
  })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Update note explaining the changes',
    example: 'Updated priority based on additional investigation',
    type: 'string',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;

}
