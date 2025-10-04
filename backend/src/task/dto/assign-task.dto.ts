import { IsNotEmpty, IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'UUID of the investigator to assign the task to',
    example: 'user-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'assignedUserId must be a valid UUID' })
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
}