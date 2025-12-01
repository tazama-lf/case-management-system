import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { TaskStatus } from '@prisma/client';
import { TaskRepository } from '../repository/task.repository';
import { CreateTaskDto } from '../task/dto/create-task.dto';
import { FlowableService } from '../flowable/flowable.service';

@Injectable()
export class TaskBridgeService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly flowableService: FlowableService,
  ) {}

  async createTask(taskDTO: CreateTaskDto, userId: string) {
    this.logger.log('Creating task', TaskBridgeService.name);
    try {
      const createdTask = await this.taskRepository.createTask({
        case: {
          connect: {
            case_id: taskDTO.caseId,
          },
        },
        name: taskDTO.name,
        description: taskDTO.description,
        candidateGroup: taskDTO.candidateGroup,
        status: taskDTO.status,
        assigned_user_id: taskDTO.assignedUserId,
      });

      this.auditLogService.logAction({
        userId,
        actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
        entityName: TaskBridgeService.name,
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });
      return { ...createdTask, candidateGroup: taskDTO.candidateGroup };
    } catch (error) {
      this.logger.error('Error creating task', error, TaskBridgeService.name);
      this.auditLogService.logAction({
        userId,
        actionPerformed: 'Error creating task',
        entityName: TaskBridgeService.name,
        operation: 'createTask',
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
      throw error;
    }
  }
}
