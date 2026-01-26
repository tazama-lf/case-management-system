import { PartialType } from '@nestjs/swagger';
import { UpdateTaskDTO } from 'src/dtos/UpdateTask.dto';
import { CaseStatus, CaseType, Priority } from '@prisma/client-cms';

export class TaskCompletionDTO extends PartialType(UpdateTaskDTO) {
  caseType: CaseType;
  casePriority: Priority;
}
