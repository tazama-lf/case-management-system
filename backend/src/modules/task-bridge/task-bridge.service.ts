import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { Outcome } from '../../utils/types/outcome';
import { TaskRepository } from '../repository/task.repository';
import { CreateTaskDto } from '../task/dto/create-task.dto';
import { FlowableService } from '../flowable/flowable.service';
import { EventLogService } from 'src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../task_history/taskHistory.service';

@Injectable()
export class TaskBridgeService {
    constructor(
        private readonly taskRepository: TaskRepository,
        private readonly logger: LoggerService,
        private readonly auditLogService: AuditLogService,
        private readonly eventLogService: EventLogService,
        private readonly taskHistoryService: TaskHistoryService,
    ) { }

    async createTask(taskDTO: CreateTaskDto, userId: string) {
        this.logger.log('Creating task', TaskBridgeService.name);
        try {
            // Fetch the case to get the tenant_id
            const caseRecord = await this.taskRepository.findCaseBasic(taskDTO.caseId);
            if (!caseRecord) {
                throw new NotFoundException(`Case ${taskDTO.caseId} not found`);
            }

            const createdTask = await this.taskRepository.createTask({
                case: {
                    connect: {
                        case_id: taskDTO.caseId,
                    },
                },
                tenant_id: caseRecord.tenant_id,
                name: taskDTO.name,
                description: taskDTO.description,
                candidateGroup: taskDTO.candidateGroup,
                status: taskDTO.status,
                assigned_user_id: taskDTO.assignedUserId,
                investigationNotes: taskDTO.investigationNotes,
            });

            this.auditLogService.logAction({
                userId,
                actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
                entityName: TaskBridgeService.name,
                operation: 'createTask',
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });

            this.eventLogService.logEventAction({
                userId,
                actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
                entityName: TaskBridgeService.name,
                operation: 'createTask',
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });

            await this.taskHistoryService.logTaskHistoryAction({
                userId,
                actionPerformed: `Created task ${createdTask.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
                entityName: TaskBridgeService.name,
                operation: 'createTask',
                task_id: createdTask.task_id,
                case_id: createdTask.case_id
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
