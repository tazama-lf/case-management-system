import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { TaskStatus } from '@prisma/client';
import { TaskRepository } from '../repository/task.repository';
import { CreateTaskDto } from '../task/dto/create-task.dto';

/**
 * TaskBridgeService - Provides task creation without circular dependencies
 * 
 * This service handles core task creation logic without depending on 
 * FlowableService or TaskService, breaking the circular dependency chain.
 */
@Injectable()
export class TaskBridgeService {
    constructor(
        private readonly repository: TaskRepository,
        private readonly logger: LoggerService,
        private readonly auditLogService: AuditLogService,
        private readonly eventEmitter: EventEmitter2
    ) { }

    /**
     * Create a new task in PostgreSQL
     * This is a streamlined version used by FlowableUtilitiesService
     * Note: Does NOT sync with Flowable - that's handled separately to avoid circular deps
     */
    async createTask(taskDTO: CreateTaskDto, userId: string) {
        this.logger.log('Creating task', TaskBridgeService.name);
        try {
            const result = await this.repository.createTaskWithAutoAssign({
                caseId: taskDTO.caseId,
                name: taskDTO.name,
                description: taskDTO.description,
                candidateGroup: taskDTO.candidateGroup,
                status: taskDTO.status,
                assignedUserId: taskDTO.assignedUserId,
            });
            const created = result.task;

            // Emit event for Flowable sync (handled by listener to avoid circular dependency)
            this.eventEmitter.emit('task.created', {
                taskId: created.task_id,
                caseId: taskDTO.caseId,
                taskName: taskDTO.name,
                description: taskDTO.description || '',
                candidateGroup: taskDTO.candidateGroup || 'Investigations',
                status: created.status,
                assignedUserId: created.assigned_user_id ?? undefined,
            });

            if (result.workQueueId && result.matchingQueue) {
                this.eventEmitter.emit('task.workQueueAssigned', {
                    taskId: created.task_id,
                    workQueueId: result.workQueueId,
                    workQueueName: result.matchingQueue.name,
                    candidateGroup: taskDTO.candidateGroup,
                    flowableGroupId: result.derivedFlowableGroupId,
                    autoAssigned: true,
                    assignedBy: 'SYSTEM',
                    tenantId: result.tenantId,
                });
            }
            this.auditLogService.logAction({
                userId,
                actionPerformed: `Created task ${created.task_id} with candidateGroup: ${taskDTO.candidateGroup}`,
                entityName: TaskBridgeService.name,
                operation: 'createTask',
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });
            return { ...created, candidateGroup: taskDTO.candidateGroup };
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
