import { ApiProperty } from '@nestjs/swagger';
import { Priority } from '@prisma/client-cms';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeCasePriorityDto {
  @ApiProperty({
    description: 'New priority to assign to the case',
    enum: Priority,
  })
  @IsEnum(Priority)
  newPriority: Priority;

  @ApiProperty({
    description: 'Optional reason for the priority change, recorded in the audit log',
    example: 'Escalated after new evidence of high transaction value',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
