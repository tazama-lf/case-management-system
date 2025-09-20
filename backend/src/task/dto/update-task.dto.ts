import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus } from './create-task.dto';

export class UpdateTaskDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsUUID()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
