import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateTaskDto } from './dto/create-task.dto';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { Outcome } from '../audit/types/outcome';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, Task, Prisma, CaseStatus, WorkQueue } from '@prisma/client';
import { NotificationService } from 'src/modules/notification/notification.service';
import { TaskCreatedEvent, TaskStatusChangedEvent, TaskAssignedEvent, TaskUnassignedEvent, CaseStatusChangedEvent } from '../events/domain-events';
import { TaskLifecycleService } from './services/task-lifecycle.service';
import { TaskRepository } from '../repository/task.repository';

export interface TaskWithCase extends Task {
	case: {
		case_id: string;
		priority: string;
		status: string;
		created_at: Date;
	};
}

@Injectable()
export class TaskService {
	constructor(
		private readonly repository: TaskRepository,
		private readonly logger: LoggerService,
		private readonly auditLogService: AuditLogService,
		private readonly eventEmitter: EventEmitter2,
		private readonly notificationService: NotificationService,
		private readonly lifecycle: TaskLifecycleService,
	) {}

	async createTask(taskDTO: CreateTaskDto, userId: string) {
		this.logger.log('Creating task', TaskService.name);
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
			this.eventEmitter.emit(
				'task.created',
				new TaskCreatedEvent(
					created.task_id,
					taskDTO.caseId,
					taskDTO.name,
					taskDTO.description || '',
					taskDTO.candidateGroup || 'Investigations',
					created.status,
					created.assigned_user_id ?? undefined,
				),
			);
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
				entityName: TaskService.name,
				operation: 'createTask',
				outcome: Outcome.SUCCESS,
				performedAt: new Date(),
			});
			return { ...created, candidateGroup: taskDTO.candidateGroup };
		} catch (error) {
			this.logger.error('Error creating task', error, TaskService.name);
			this.auditLogService.logAction({
				userId,
				actionPerformed: 'Error creating task',
				entityName: TaskService.name,
				operation: 'createTask',
				outcome: Outcome.FAILURE,
				performedAt: new Date(),
			});
			throw error;
		}
	}

	async reassignTask(taskId: string, userId: string, tenantId: string, assignedUserId: string) {
		return this.lifecycle.reassignTask(taskId, userId, tenantId, assignedUserId);
	}

	async updateTask(taskId: string, updateData: Partial<UpdateTaskDto>, userId: string, auditLogService: AuditLogService | null) {
		this.logger.log(`Updating task ${taskId}`, TaskService.name);

		try {
			const existingTask = await this.repository.findTaskWithCase(taskId);

			if (!existingTask) {
				throw new NotFoundException(`Task ${taskId} not found`);
			}

			const updateInput: Prisma.TaskUpdateInput = {
				status: updateData.status,
				name: updateData.name,
				description: updateData.description,
			};

			if (updateData.assignedUserId !== undefined) {
				if (updateData.assignedUserId) {
					updateInput.assigned_user_id = updateData.assignedUserId;
				} else {
					updateInput.assigned_user_id = null;
				}
			}

			const newStatus = updateData.status;
			const statusChanged = newStatus !== undefined && newStatus !== existingTask.status;
			const shouldPromoteCaseToInProgress =
				statusChanged && newStatus === TaskStatus.STATUS_20_IN_PROGRESS && this.isInvestigationTask(existingTask.name);

			let updatedTask: Task;
			let caseStatusTransition: { previous: CaseStatus; next: CaseStatus } | null = null;
			if (shouldPromoteCaseToInProgress) {
				const txResult = await this.repository.transaction(async (tx) => {
					const taskRecord = await this.repository.updateTask(taskId, updateInput, tx);
					const caseRecord = await this.repository.findCaseStatus(taskRecord.case_id, tx);
					if (!caseRecord) throw new NotFoundException(`Case ${taskRecord.case_id} not found`);
					if (this.isCaseEligibleForInProgress(caseRecord.status) && caseRecord.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
						const assigneeId = taskRecord.assigned_user_id || existingTask.assigned_user_id || null;
						const caseUpdateData: Prisma.CaseUpdateInput = { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() };
						if (assigneeId && caseRecord.case_owner_user_id !== assigneeId) caseUpdateData.case_owner_user_id = assigneeId;
						await this.repository.updateCase(taskRecord.case_id, caseUpdateData, tx);
						return { taskRecord, previousCaseStatus: caseRecord.status, updatedCaseStatus: CaseStatus.STATUS_20_IN_PROGRESS };
					}
					return { taskRecord, previousCaseStatus: caseRecord.status, updatedCaseStatus: caseRecord.status };
				});
				updatedTask = txResult.taskRecord;
				if (txResult.updatedCaseStatus !== txResult.previousCaseStatus) {
					caseStatusTransition = { previous: txResult.previousCaseStatus, next: txResult.updatedCaseStatus };
				}
			} else {
				updatedTask = await this.repository.updateTask(taskId, updateInput);
			}

			if (newStatus !== undefined && newStatus !== existingTask.status) {
				this.eventEmitter.emit(
					'task.status.changed',
					new TaskStatusChangedEvent(
						taskId,
						updatedTask.case_id,
						updatedTask.name || '',
						existingTask.status,
						newStatus,
						updatedTask.assigned_user_id || undefined,
					),
				);
			}

			if (updateData.assignedUserId !== undefined && updateData.assignedUserId !== existingTask.assigned_user_id) {
				if (updateData.assignedUserId) {
					this.eventEmitter.emit(
						'task.assigned',
						new TaskAssignedEvent(taskId, updatedTask.case_id, updateData.assignedUserId, existingTask.assigned_user_id || undefined),
					);
				} else {
					this.eventEmitter.emit(
						'task.unassigned',
						new TaskUnassignedEvent(taskId, updatedTask.case_id, existingTask.assigned_user_id || undefined),
					);
				}
			}

			if (caseStatusTransition) {
				this.eventEmitter.emit(
					'case.status.changed',
					new CaseStatusChangedEvent(
						updatedTask.case_id,
						caseStatusTransition.previous,
						caseStatusTransition.next,
						`Investigation task ${updatedTask.task_id} moved to in-progress`,
					),
				);
			}

			this.logger.log(`Task updated: ${updatedTask.task_id}`, TaskService.name);

			const auditService = auditLogService || this.auditLogService;
			auditService.logAction({
				userId,
				actionPerformed: caseStatusTransition
					? `Updated task ${taskId} and moved case ${updatedTask.case_id} to STATUS_20_IN_PROGRESS`
					: `Updated task ${taskId}`,
				entityName: TaskService.name,
				operation: 'updateTask',
				outcome: Outcome.SUCCESS,
				performedAt: new Date(),
			});

			return updatedTask;
		} catch (error) {
			this.logger.error(`Error updating task ${taskId}`, error, TaskService.name);

			const auditService = auditLogService || this.auditLogService;
			auditService.logAction({
				userId,
				actionPerformed: `Error updating task ${taskId}: ${JSON.stringify(updateData)}`,
				entityName: TaskService.name,
				operation: 'updateTask',
				outcome: Outcome.FAILURE,
				performedAt: new Date(),
			});
			throw error;
		}
	}

	async getTasksByCandidateGroup(candidateGroup: string, userId: string) {
		this.logger.log(`Retrieving tasks for candidateGroup: ${candidateGroup}`, TaskService.name);

		try {
			const dbTasks = (await this.repository.findTasks(
				{
					candidateGroup: candidateGroup,
					status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
				},
				true,
			)) as TaskWithCase[];

			this.auditLogService.logAction({
				userId,
				operation: 'getTasksByCandidateGroup',
				entityName: TaskService.name,
				actionPerformed: `Successfully retrieved ${dbTasks.length} tasks for candidateGroup: ${candidateGroup}`,
				outcome: Outcome.SUCCESS,
			});

			return dbTasks;
		} catch (error) {
			this.logger.error(`Error retrieving tasks for candidateGroup: ${candidateGroup}`, error, TaskService.name);
			this.auditLogService.logAction({
				userId,
				operation: 'getTasksByCandidateGroup',
				entityName: TaskService.name,
				actionPerformed: `Error retrieving tasks for candidateGroup: ${candidateGroup}`,
				outcome: Outcome.FAILURE,
			});
			throw error;
		}
	}

	async getInvestigationQueue() {
		try {
			const dbTasks: TaskWithCase[] = (await this.repository.findTasks(
				{ candidateGroup: 'investigations', status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED] } },
				true,
			)) as any;

			return dbTasks;
		} catch (error) {
			this.logger.error('Error retrieving investigation queue', error, TaskService.name);
			throw error;
		}
	}

	async getTasksByCaseId(caseId: string, userId?: string) {
		this.logger.log('Retrieving tasks by case', TaskService.name);

		try {
			const tasks = await this.repository.findTasks({ case_id: caseId }, true);

			if (userId) {
				this.auditLogService.logAction({
					userId,
					operation: 'getTasksByCaseId',
					entityName: TaskService.name,
					actionPerformed: `Successfully retrieved tasks for case: ${caseId}`,
					outcome: Outcome.SUCCESS,
					performedAt: new Date(),
				});
			}

			return tasks;
		} catch (error) {
			this.logger.error('Error retrieving tasks', error, TaskService.name);
			if (userId) {
				this.auditLogService.logAction({
					userId,
					operation: 'getTasksByCaseId',
					entityName: TaskService.name,
					actionPerformed: `Error retrieving tasks for case: ${caseId}`,
					outcome: Outcome.FAILURE,
					performedAt: new Date(),
				});
			}
			throw error;
		}
	}

	async assignTaskToInvestigator(taskId: string, assignedUserId: string, supervisorId: string, tenantId: string) {
		return this.lifecycle.assignTaskToInvestigator(taskId, assignedUserId, supervisorId, tenantId);
	}

	async selfAssignTask(taskId: string, investigatorUserId: string, tenantId: string) {
		return this.lifecycle.selfAssignTask(taskId, investigatorUserId, tenantId);
	}

	async getTasks(status?: string) {
		try {
			const where = status ? { status: status as TaskStatus } : {};
			return await this.repository.findTasks(where, true);
		} catch (error) {
			this.logger.error('Error retrieving tasks', error, TaskService.name);
			throw error;
		}
	}

	async getTaskById(taskId: string) {
		try {
			return await this.repository.findTaskWithCase(taskId);
		} catch (error) {
			this.logger.error(`Error retrieving task ${taskId}`, error, TaskService.name);
			throw error;
		}
	}

	async getWorkQueue(filters: {
		role?: string;
		candidateGroup?: string;
		page?: number;
		limit?: number;
		unassignedOnly?: boolean;
		assignedToMe?: string;
	}) {
		try {
			const { candidateGroup, page = 1, limit = 20, unassignedOnly = false, assignedToMe } = filters;

			const whereClause: any = {
				status: {
					in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
				},
			};

			if (candidateGroup) {
				whereClause.candidateGroup = candidateGroup;
			}

			if (unassignedOnly) {
				whereClause.assigned_user_id = null;
			} else if (assignedToMe) {
				whereClause.assigned_user_id = assignedToMe;
			}

			const totalCount = await this.repository.countTasks(whereClause);

			const start = (page - 1) * limit;
			const dbTasks = (await this.repository.findTasks(whereClause, true, start, limit)) as TaskWithCase[];

			const tasks = dbTasks.map((task) => ({
				taskId: task.task_id,
				name: task.name,
				description: task.description,
				status: task.status,
				assignedUser: task.assigned_user_id,
				candidateGroup: task.candidateGroup,
				case: task.case,
				created: task.created_at,
			}));

			return {
				tasks,
				total: totalCount,
				page,
				limit,
				totalPages: Math.ceil(totalCount / limit),
			};
		} catch (error) {
			this.logger.error('Error retrieving work queue', error, TaskService.name);
			throw error;
		}
	}

	async getWorkQueueStatistics(userId: string) {
		try {
			const candidateGroups = ['Supervisors', 'Investigations', 'Investigator'];
			const statistics: Record<string, any> = {};

			for (const group of candidateGroups) {
				const tasks = await this.repository.findTasks({
					candidateGroup: group,
					status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
				}, false);

				statistics[group] = {
					total: tasks.length,
					unassigned: tasks.filter((t) => !t.assigned_user_id).length,
					assigned: tasks.filter((t) => t.assigned_user_id).length,
				};
			}

			const userTasks = await this.repository.findTasks({
				assigned_user_id: userId,
				status: { in: [TaskStatus.STATUS_01_UNASSIGNED, TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
			}, false);

			return {
				queues: statistics,
				userStats: {
					totalAssigned: userTasks.length,
					byStatus: userTasks.reduce((acc: any, task) => {
						const status = task.status || 'unknown';
						acc[status] = (acc[status] || 0) + 1;
						return acc;
					}, {}),
				},
			};
		} catch (error) {
			this.logger.error('Error getting work queue statistics', error, TaskService.name);
			throw error;
		}
	}

	async claimTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
		this.logger.log(`User ${userId} claiming task ${taskId}`, TaskService.name);

		try {
			const existingTask = await this.repository.findTaskById(taskId);
			if (!existingTask) {
				throw new NotFoundException(`Task ${taskId} not found`);
			}

			const previousAssignedUserId = existingTask.assigned_user_id;

			const updatedTask = await this.repository.updateTask(taskId, {
				assigned_user_id: userId,
				status: TaskStatus.STATUS_10_ASSIGNED,
			});

			this.eventEmitter.emit(
				'task.assigned',
				new TaskAssignedEvent(taskId, updatedTask.case_id, userId, previousAssignedUserId || undefined),
			);

			const auditService = auditLogService || this.auditLogService;
			auditService.logAction({
				userId,
				actionPerformed: `Claimed task ${taskId}`,
				entityName: TaskService.name,
				operation: 'claimTask',
				outcome: Outcome.SUCCESS,
				performedAt: new Date(),
			});

			return updatedTask;
		} catch (error) {
			this.logger.error(`Error claiming task ${taskId}`, error, TaskService.name);
			throw error;
		}
	}

	async unassignTask(taskId: string, userId: string, tenantId: string, reason?: string) {
		return this.lifecycle.unassignTask(taskId, userId, tenantId, reason || '');
	}

	async releaseTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
		return this.lifecycle.releaseTask(taskId, userId);
	}

	async completeTask(taskId: string, userId: string, auditLogService?: AuditLogService) {
		return this.lifecycle.completeTask(taskId, userId);
	}

	async getUserTasks(userId: string, includeCompleted: boolean = false) {
		try {
			const statusFilter = includeCompleted
				? {}
				: {
					status: {
						not: TaskStatus.STATUS_30_COMPLETED,
					},
				};

			return await this.repository.findTasks({ assigned_user_id: userId, ...statusFilter }, true);
		} catch (error) {
			this.logger.error(`Error retrieving tasks for user ${userId}`, error, TaskService.name);
			throw error;
		}
	}

	async reassignTaskToWorkQueue(taskId: string, targetWorkQueueId: string, userId: string, tenantId: string, reason?: string, assignedUserId?: string) {
		return this.lifecycle.reassignTaskToWorkQueue(taskId, targetWorkQueueId, userId, tenantId, reason, assignedUserId);
	}

	private isInvestigationTask(taskName?: string | null): boolean {
		return (taskName || '').trim().toLowerCase() === 'investigate case';
	}

	private isCaseEligibleForInProgress(status: CaseStatus): boolean {
		const eligibleStatuses: CaseStatus[] = [
			CaseStatus.STATUS_10_ASSIGNED,
			CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
			CaseStatus.STATUS_03_RETURNED,
		];

		return eligibleStatuses.includes(status);
	}
}
