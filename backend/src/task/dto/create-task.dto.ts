import { TaskStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  caseId: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  assignedUserId: string;

  @IsString()
  name: string;

  @IsString()
  description: string;
}
