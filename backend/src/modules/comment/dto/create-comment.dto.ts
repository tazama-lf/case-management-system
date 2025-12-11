import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MaxLength(500)
  note: string;

  @IsNumber()
  caseId: number;

  @IsOptional()
  @IsNumber()
  taskId?: number;
}
