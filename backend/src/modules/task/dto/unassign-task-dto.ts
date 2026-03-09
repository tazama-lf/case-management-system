import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnassignTaskDto {
  @ApiProperty({
    description: 'Reason for unassigning the task (minimum 4 characters)',
    example: 'Reassigning due to workload constraints and priority conflicts',
    minLength: 4,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason for unassigning task is required' })
  @MinLength(4, { message: 'Reason must be at least 4 characters long' })
  @MaxLength(500)
  reason: string;
}
