import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
export enum TaskStatus {
  STATUS_01_UNASSIGNED = 'STATUS_01_UNASSIGNED',
  STATUS_10_ASSIGNED = 'STATUS_10_ASSIGNED',
  STATUS_20_IN_PROGRESS = 'STATUS_20_IN_PROGRESS',
  STATUS_30_COMPLETED = 'STATUS_30_COMPLETED',
  STATUS_21_BLOCKED = 'STATUS_21_BLOCKED',
}

export class CreateTaskDto {
  @IsUUID()
  caseId: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  candidateGroup?: string;
}