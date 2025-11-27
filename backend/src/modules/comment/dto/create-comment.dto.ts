import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MaxLength(500)
  note: string;

  @IsUUID()
  caseId: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
