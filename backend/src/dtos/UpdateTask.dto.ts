import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './CreateTask.dto';

export class UpdateTaskDTO extends PartialType(OmitType(CreateTaskDto, ['caseId', 'taskType', 'name', 'description'])) {}
