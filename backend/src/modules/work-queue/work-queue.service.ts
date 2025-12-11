import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogService } from '../audit/auditLog.service';
import { FlowableService } from '../flowable/flowable.service';
import { Prisma, TaskStatus, AssignmentRuleType, WorkQueueAssignmentRule } from '@prisma/client';
import { RuleEngineService } from './rule-engine.service';
import { CreateAssignmentRuleDto, CreateWorkQueueDto, DetailedAssignmentRuleDto, GetWorkQueuesQueryDto, OverdueTaskDto, SLABreachTaskDto, SupervisorDashboardDto, TaskFilterDto, UpdateAssignmentRuleDto, UpdateWorkQueueDto, WorkQueueDetailResponseDto, WorkQueueListResponseDto, WorkQueueResponseDto, WorkQueueMetricsDto, TaskListResponseDto  } from './dto';

@Injectable()
export class WorkQueueService implements OnModuleInit {
  private readonly logger = new Logger(WorkQueueService.name);

  // Predefined candidate groups managed by Work Queue module
  private readonly predefinedCandidateGroups = ['Supervisors', 'Investigations', 'Investigator'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ruleEngine: RuleEngineService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => FlowableService))
    private readonly flowableService: FlowableService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Initialize predefined candidate groups in Flowable
    await this.initializePredefinedCandidateGroups();

    // Emit a bootstrap sync event for all active work queues so Flowable can reconcile identity.
    try {
      const queues = await this.prisma.workQueue.findMany({
        where: { is_active: true },
        select: { work_queue_id: true, name: true, tenant_id: true, is_active: true },
      });

      // Prepare all sync events first to avoid synchronous emission in loop
      const syncEvents = await Promise.all(
        queues.map(async (q) => {
          const flowableGroupId = this.deriveFlowableGroupId(q.tenant_id, q.name);
          const members = await this.prisma.workQueueMember.findMany({
            where: { work_queue_id: q.work_queue_id },
            select: { user_id: true },
          });

          return {
            workQueueId: q.work_queue_id,
            tenantId: q.tenant_id,
            name: q.name,
            isActive: q.is_active,
            flowableGroupId,
            members: members.map((m) => m.user_id),
          };
        }),
      );

      // Emit all events asynchronously using setImmediate to avoid blocking
      syncEvents.forEach((syncEvent) => {
        setImmediate(() => {
          this.eventEmitter.emit('workQueue.sync', syncEvent);
        });
      });
      this.logger.log(`Emitted sync for ${queues.length} work queues`);
    } catch (e) {
      this.logger.error(`Failed to emit work queue sync on init: ${e.message}`);
    }
  }

  /**
   * Initialize predefined candidate groups in Flowable
   **/

  private async initializePredefinedCandidateGroups() {
    this.logger.log('Initializing predefined candidate groups via WorkQueue module', WorkQueueService.name);

    for (const groupName of this.predefinedCandidateGroups) {
      try {
        // Use FlowableService to create the group in Flowable engine
        const existingGroup = await this.flowableService.getGroup(groupName.toLowerCase());

        if (!existingGroup) {
          await this.flowableService.createGroup({
            id: groupName.toLowerCase(),
            name: groupName,
            type: 'candidate',
          });
          this.logger.log(`Created candidate group: ${groupName}`, WorkQueueService.name);
        } else {
          this.logger.log(`Candidate group already exists: ${groupName}`, WorkQueueService.name);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize candidate group ${groupName}: ${error.message}`, error.stack, WorkQueueService.name);
      }
    }
  }

  /**
   * Canonical Flowable group ID derivation for a work queue
   * Format: tenant-<tenantId>__queue-<slug(name)>
   */
  private deriveFlowableGroupId(tenantId: string, name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    return `tenant-${tenantId}__queue-${slug}`;
  }

  /**
   * Create a new work queue
   */
  async createWorkQueue(dto: CreateWorkQueueDto, tenantId: string, userId: string): Promise<WorkQueueDetailResponseDto> {
    const existing = await this.prisma.workQueue.findFirst({
      where: {
        name: dto.name,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException(`Work queue with name '${dto.name}' already exists for this tenant`);
    }

    const workQueue = await this.prisma.$transaction(async (tx) => {
      const queue = await tx.workQueue.create({
        data: {
          name: dto.name,
          description: dto.description,
          tenant_id: tenantId,
          created_by_user_id: userId,
          roles: {
            create: dto.roles.map((role) => ({
              role,
            })),
          },
          taskTypes: {
            create: dto.taskTypes.map((taskType) => ({
              task_type: taskType,
            })),
          },
          assignmentRules: dto.assignmentRules
            ? {
                create: dto.assignmentRules.map((rule) => ({
                  rule_name: rule.ruleName,
                  rule_type: AssignmentRuleType.MANUAL, // Legacy field
                  rule_config: {}, // Legacy field
                  trigger_type: rule.triggerType,
                  conditions: rule.conditions as unknown as Prisma.InputJsonValue,
                  actions: rule.action as unknown as Prisma.InputJsonValue,
                  stop_on_match: rule.stopOnMatch || false,
                  priority_order: rule.priorityOrder || 0,
                  is_active: rule.isActive !== undefined ? rule.isActive : true,
                  created_by: userId,
                })),
              }
            : undefined,
        },
        include: {
          roles: true,
          taskTypes: true,
          assignmentRules: true,
          _count: {
            select: { tasks: true },
          },
        },
      });

      return queue;
    });

    await this.logAuditEvent(userId, 'CREATE', 'WorkQueue', `Created work queue: ${workQueue.name}`, 'SUCCESS');

    this.eventEmitter.emit('workQueue.created', {
      workQueueId: workQueue.work_queue_id,
      name: workQueue.name,
      tenantId: workQueue.tenant_id,
      userId,
      flowableGroupId: this.deriveFlowableGroupId(workQueue.tenant_id, workQueue.name),
    });

    this.logger.log(`Work queue '${workQueue.name}' created successfully by user ${userId}`);

    return this.mapToDetailResponse(workQueue);
  }

  /**
   * Get all work queues with filters and pagination
   */
  async getAllWorkQueues(query: GetWorkQueuesQueryDto, tenantId?: string): Promise<WorkQueueListResponseDto> {
    const { page = 1, limit = 20, role, isActive, sortBy = 'created_at', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkQueueWhereInput = {
      tenant_id: tenantId || query.tenantId,
      is_active: isActive,
      ...(role && {
        roles: {
          some: {
            role,
          },
        },
      }),
    };

    const [workQueues, total] = await Promise.all([
      this.prisma.workQueue.findMany({
        where,
        include: {
          roles: true,
          taskTypes: true,
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.workQueue.count({ where }),
    ]);

    return {
      data: workQueues.map((wq) => this.mapToResponse(wq)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get work queue by ID with full details
   */
  async getWorkQueueById(workQueueId: number, tenantId?: string): Promise<WorkQueueDetailResponseDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        ...(tenantId && { tenant_id: tenantId }),
      },
      include: {
        roles: true,
        taskTypes: true,
        assignmentRules: {
          orderBy: { priority_order: 'asc' },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    return this.mapToDetailResponse(workQueue);
  }

  /**
   * Get work queues by role
   */
  async getWorkQueuesByRole(role: string, tenantId: string): Promise<WorkQueueResponseDto[]> {
    const workQueues = await this.prisma.workQueue.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        roles: {
          some: {
            role: role as any,
          },
        },
      },
      include: {
        roles: true,
        taskTypes: true,
        _count: {
          select: { tasks: true },
        },
      },
    });

    return workQueues.map((wq) => this.mapToResponse(wq));
  }

  /**
   * Update work queue
   */
  async updateWorkQueue(
    workQueueId: number,
    dto: UpdateWorkQueueDto,
    tenantId: string,
    userId: string,
  ): Promise<WorkQueueDetailResponseDto> {
    const existing = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.workQueue.findFirst({
        where: {
          name: dto.name,
          tenant_id: tenantId,
          work_queue_id: { not: workQueueId },
        },
      });

      if (nameExists) {
        throw new ConflictException(`Work queue with name '${dto.name}' already exists for this tenant`);
      }
    }

    const workQueue = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workQueue.update({
        where: { work_queue_id: workQueueId },
        data: {
          name: dto.name,
          description: dto.description,
          is_active: dto.isActive,
        },
      });

      if (dto.roles) {
        await tx.workQueueRole.deleteMany({
          where: { work_queue_id: workQueueId },
        });
        await tx.workQueueRole.createMany({
          data: dto.roles.map((role) => ({
            work_queue_id: workQueueId,
            role,
          })),
        });
      }

      if (dto.taskTypes) {
        await tx.workQueueTaskType.deleteMany({
          where: { work_queue_id: workQueueId },
        });
        await tx.workQueueTaskType.createMany({
          data: dto.taskTypes.map((taskType) => ({
            work_queue_id: workQueueId,
            task_type: taskType,
          })),
        });
      }

      if (dto.assignmentRules) {
        await tx.workQueueAssignmentRule.deleteMany({
          where: { work_queue_id: workQueueId },
        });
        await tx.workQueueAssignmentRule.createMany({
          data: dto.assignmentRules.map((rule) => ({
            work_queue_id: workQueueId,
            rule_name: rule.ruleName,
            rule_type: AssignmentRuleType.MANUAL, // Legacy field
            rule_config: {}, // Legacy field
            trigger_type: rule.triggerType,
            conditions: rule.conditions as unknown as Prisma.InputJsonValue,
            actions: rule.action as unknown as Prisma.InputJsonValue,
            stop_on_match: rule.stopOnMatch || false,
            priority_order: rule.priorityOrder || 0,
            is_active: rule.isActive !== undefined ? rule.isActive : true,
            created_by: userId,
          })),
        });
      }

      return tx.workQueue.findUnique({
        where: { work_queue_id: workQueueId },
        include: {
          roles: true,
          taskTypes: true,
          assignmentRules: true,
          _count: {
            select: { tasks: true },
          },
        },
      });
    });

    await this.logAuditEvent(userId, 'UPDATE', 'WorkQueue', `Updated work queue: ${workQueue?.name || workQueueId}`, 'SUCCESS');

    const oldFlowableGroupId = this.deriveFlowableGroupId(tenantId, existing.name);
    const newName = dto.name ?? existing.name;
    const flowableGroupId = this.deriveFlowableGroupId(tenantId, newName);

    this.eventEmitter.emit('workQueue.updated', {
      workQueueId,
      tenantId,
      userId,
      changes: dto,
      name: newName,
      flowableGroupId,
      oldFlowableGroupId,
    });

    this.logger.log(`Work queue ${workQueueId} updated by user ${userId}`);

    return this.mapToDetailResponse(workQueue);
  }

  /**
   * Deactivate work queue (soft delete)
   */
  async deactivateWorkQueue(workQueueId: number, tenantId: string, userId: string): Promise<void> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    await this.prisma.workQueue.update({
      where: { work_queue_id: workQueueId },
      data: { is_active: false },
    });

    await this.logAuditEvent(userId, 'DEACTIVATE', 'WorkQueue', `Deactivated work queue: ${workQueue.name}`, 'SUCCESS');

    this.eventEmitter.emit('workQueue.deactivated', {
      workQueueId,
      tenantId,
      userId,
      flowableGroupId: this.deriveFlowableGroupId(tenantId, workQueue.name),
    });

    this.logger.log(`Work queue ${workQueue.name} deactivated by user ${userId}`);
  }

  /**
   * Delete work queue (hard delete with safeguards)
   */
  async deleteWorkQueue(workQueueId: number, tenantId: string, userId: string, reassignQueueId?: number): Promise<void> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    if (workQueue._count.tasks > 0) {
      if (reassignQueueId) {
        await this.prisma.task.updateMany({
          where: { work_queue_id: workQueueId },
          data: { work_queue_id: reassignQueueId },
        });
      } else {
        throw new BadRequestException(
          `Cannot delete work queue with ${workQueue._count.tasks} active tasks. ` +
            'Provide a reassignQueueId to reassign tasks or deactivate the queue instead.',
        );
      }
    }

    await this.prisma.workQueue.delete({
      where: { work_queue_id: workQueueId },
    });

    await this.logAuditEvent(userId, 'DELETE', 'WorkQueue', `Deleted work queue: ${workQueue?.name || workQueueId}`, 'SUCCESS');

    this.eventEmitter.emit('workQueue.deleted', {
      workQueueId,
      tenantId,
      userId,
      reassignQueueId,
      flowableGroupId: this.deriveFlowableGroupId(tenantId, workQueue.name),
    });

    this.logger.log(`Work queue ${workQueueId} deleted by user ${userId}`);
  }

  /**
   * Get work queue statistics
   */
  async getWorkQueueStatistics(workQueueId: number, tenantId?: string) {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        ...(tenantId && { tenant_id: tenantId }),
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const [totalTasks, pendingTasks, inProgressTasks, completedTasks, blockedTasks] = await Promise.all([
      this.prisma.task.count({
        where: { work_queue_id: workQueueId },
      }),
      this.prisma.task.count({
        where: {
          work_queue_id: workQueueId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
      }),
      this.prisma.task.count({
        where: {
          work_queue_id: workQueueId,
          status: TaskStatus.STATUS_20_IN_PROGRESS,
        },
      }),
      this.prisma.task.count({
        where: {
          work_queue_id: workQueueId,
          status: TaskStatus.STATUS_30_COMPLETED,
        },
      }),
      this.prisma.task.count({
        where: {
          work_queue_id: workQueueId,
          status: TaskStatus.STATUS_21_BLOCKED,
        },
      }),
    ]);

    return {
      workQueueId,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      blockedTasks,
    };
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponse(workQueue: any): WorkQueueResponseDto {
    return {
      workQueueId: workQueue.work_queue_id,
      name: workQueue.name,
      description: workQueue.description,
      tenantId: workQueue.tenant_id,
      isActive: workQueue.is_active,
      createdByUserId: workQueue.created_by_user_id,
      roles: workQueue.roles.map((r: any) => r.role),
      taskTypes: workQueue.taskTypes.map((tt: any) => tt.task_type),
      taskCount: workQueue._count?.tasks || 0,
      createdAt: workQueue.created_at,
      updatedAt: workQueue.updated_at,
    };
  }

  /**
   * Map database model to detailed response DTO
   */
  private mapToDetailResponse(workQueue: any): WorkQueueDetailResponseDto {
    const base = this.mapToResponse(workQueue);

    return {
      ...base,
      assignmentRules:
        workQueue.assignmentRules?.map((rule: any) => ({
          assignmentRuleId: rule.assignment_rule_id,
          ruleType: rule.rule_type,
          ruleConfig: rule.rule_config,
          priorityOrder: rule.priority_order,
          isActive: rule.is_active,
          createdAt: rule.created_at,
          updatedAt: rule.updated_at,
        })) || [],
      pendingTaskCount: 0,
      inProgressTaskCount: 0,
      completedTaskCount: 0,
    };
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    userId: string,
    operation: string,
    entityName: string,
    actionPerformed: string,
    outcome: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: userId,
          operation,
          entity_name: entityName,
          action_performed: actionPerformed,
          outcome,
          performed_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`);
    }
  }

  /**
   * Assign users to a work queue
   */
  async assignUsers(
    workQueueId: number,
    userIds: string[],
    tenantId: string,
    assignedByUserId: string,
    assignmentType: string = 'MANUAL',
  ): Promise<any[]> {
    const workQueue = await this.getWorkQueueById(workQueueId, tenantId);

    const assignments: any[] = [];

    for (const userId of userIds) {
      try {
        const existing = await this.prisma.workQueueMember.findUnique({
          where: {
            work_queue_id_user_id: {
              work_queue_id: workQueueId,
              user_id: userId,
            },
          },
        });

        if (existing) {
          const updated = await this.prisma.workQueueMember.update({
            where: { work_queue_member_id: existing.work_queue_member_id },
            data: {
              assignment_type: assignmentType as any,
              assigned_by_user_id: assignedByUserId,
              updated_at: new Date(),
            },
          });

          assignments.push({
            memberId: updated.work_queue_member_id,
            workQueueId: updated.work_queue_id,
            userId: updated.user_id,
            assignmentType: updated.assignment_type,
            assignedBy: updated.assigned_by_user_id,
            assignedAt: updated.assigned_at,
          });
        } else {
          const member = await this.prisma.workQueueMember.create({
            data: {
              work_queue_id: workQueueId,
              user_id: userId,
              assignment_type: assignmentType as any,
              assigned_by_user_id: assignedByUserId,
            },
          });

          assignments.push({
            memberId: member.work_queue_member_id,
            workQueueId: member.work_queue_id,
            userId: member.user_id,
            assignmentType: member.assignment_type,
            assignedBy: member.assigned_by_user_id,
            assignedAt: member.assigned_at,
          });
        }

        await this.logAuditEvent(
          assignedByUserId,
          'ASSIGN_USER',
          'WorkQueueMember',
          `Assigned user ${userId} to work queue ${workQueue.name} (type: ${assignmentType})`,
          'SUCCESS',
        );

        this.eventEmitter.emit('workQueue.userAssigned', {
          workQueueId,
          userId,
          assignedBy: assignedByUserId,
          assignmentType,
          tenantId,
          workQueueName: workQueue.name,
          flowableGroupId: this.deriveFlowableGroupId(tenantId, workQueue.name),
        });

        this.logger.log(`User ${userId} assigned to work queue ${workQueueId} by ${assignedByUserId}`);
      } catch (error) {
        this.logger.error(`Failed to assign user ${userId} to work queue ${workQueueId}: ${error.message}`);
        throw error;
      }
    }

    return assignments;
  }

  /**
   * Remove users from a work queue
   */
  async removeUsers(workQueueId: number, userIds: string[], tenantId: string, removedByUserId: string): Promise<number> {
    const workQueue = await this.getWorkQueueById(workQueueId, tenantId);

    let removedCount = 0;

    for (const userId of userIds) {
      try {
        const member = await this.prisma.workQueueMember.findUnique({
          where: {
            work_queue_id_user_id: {
              work_queue_id: workQueueId,
              user_id: userId,
            },
          },
        });

        if (!member) {
          this.logger.warn(`User ${userId} is not assigned to work queue ${workQueueId}`);
          continue;
        }

        await this.prisma.workQueueMember.delete({
          where: { work_queue_member_id: member.work_queue_member_id },
        });

        removedCount++;

        await this.logAuditEvent(
          removedByUserId,
          'REMOVE_USER',
          'WorkQueueMember',
          `Removed user ${userId} from work queue ${workQueue.name}`,
          'SUCCESS',
        );

        this.eventEmitter.emit('workQueue.userRemoved', {
          workQueueId,
          userId,
          removedBy: removedByUserId,
          tenantId,
          workQueueName: workQueue.name,
          flowableGroupId: this.deriveFlowableGroupId(tenantId, workQueue.name),
        });

        this.logger.log(`User ${userId} removed from work queue ${workQueueId} by ${removedByUserId}`);
      } catch (error) {
        this.logger.error(`Failed to remove user ${userId} from work queue ${workQueueId}: ${error.message}`);
        throw error;
      }
    }

    return removedCount;
  }

  /**
   * Get all members of a work queue
   */
  async getWorkQueueMembers(workQueueId: number, tenantId: string): Promise<any[]> {
    await this.getWorkQueueById(workQueueId, tenantId);

    const members = await this.prisma.workQueueMember.findMany({
      where: { work_queue_id: workQueueId },
      orderBy: { assigned_at: 'desc' },
    });

    return members.map((member) => ({
      memberId: member.work_queue_member_id,
      userId: member.user_id,
      assignmentType: member.assignment_type,
      assignedBy: member.assigned_by_user_id,
      assignedAt: member.assigned_at,
      updatedAt: member.updated_at,
    }));
  }

  /**
   * Get all work queues a user is assigned to
   */
  async getUserWorkQueueAssignments(userId: string, tenantId: string): Promise<any[]> {
    const assignments = await this.prisma.workQueueMember.findMany({
      where: {
        user_id: userId,
        workQueue: {
          tenant_id: tenantId,
          is_active: true,
        },
      },
      include: {
        workQueue: {
          include: {
            roles: true,
            taskTypes: true,
            _count: {
              select: { tasks: true },
            },
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });

    return assignments.map((assignment) => ({
      memberId: assignment.work_queue_member_id,
      assignmentType: assignment.assignment_type,
      assignedAt: assignment.assigned_at,
      workQueue: {
        workQueueId: assignment.workQueue.work_queue_id,
        name: assignment.workQueue.name,
        description: assignment.workQueue.description,
        isActive: assignment.workQueue.is_active,
        roles: assignment.workQueue.roles.map((r: any) => r.role),
        taskTypes: assignment.workQueue.taskTypes.map((tt: any) => tt.task_type),
        taskCount: assignment.workQueue._count.tasks,
      },
    }));
  }

  /**
   * Auto-assign users to work queues based on their roles
   */
  async autoAssignUsersByRole(userId: string, userRole: string, tenantId: string): Promise<any[]> {
    if (this.configService.get('AUTO_ASSIGNMENT_ENABLED') !== 'true') {
      this.logger.log('Auto-assignment is disabled by configuration.');
      return [];
    }

    const matchingQueues = await this.prisma.workQueue.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        roles: {
          some: {
            role: userRole as any,
          },
        },
      },
    });

    const assignments: any[] = [];

    for (const queue of matchingQueues) {
      try {
        const existing = await this.prisma.workQueueMember.findUnique({
          where: {
            work_queue_id_user_id: {
              work_queue_id: queue.work_queue_id,
              user_id: userId,
            },
          },
        });

        if (existing && existing.assignment_type === 'OVERRIDE') {
          this.logger.log(`Skipping auto-assignment for user ${userId} to queue ${queue.work_queue_id} - has OVERRIDE assignment`);
          continue;
        }

        const result = await this.assignUsers(queue.work_queue_id, [userId], tenantId, 'SYSTEM', 'AUTOMATIC');

        assignments.push(...result);
      } catch (error) {
        this.logger.error(`Failed to auto-assign user ${userId} to queue ${queue.work_queue_id}: ${error.message}`);
      }
    }

    return assignments;
  }

  /**
   * Handle role change event - update automatic assignments
   */
  async handleUserRoleChange(userId: string, newRole: string, tenantId: string): Promise<void> {
    this.logger.log(`Handling role change for user ${userId} to ${newRole} in tenant ${tenantId}`);

    const currentAssignments = await this.prisma.workQueueMember.findMany({
      where: {
        user_id: userId,
        assignment_type: 'AUTOMATIC',
        workQueue: {
          tenant_id: tenantId,
        },
      },
      include: {
        workQueue: {
          include: {
            roles: true,
          },
        },
      },
    });

    for (const assignment of currentAssignments) {
      const roleMatch = assignment.workQueue.roles.some((r: any) => r.role === newRole);

      if (!roleMatch) {
        await this.prisma.workQueueMember.delete({
          where: { work_queue_member_id: assignment.work_queue_member_id },
        });

        await this.logAuditEvent(
          'SYSTEM',
          'REMOVE_USER',
          'WorkQueueMember',
          `Automatically removed user ${userId} from work queue ${assignment.workQueue.name} due to role change`,
          'SUCCESS',
        );

        this.eventEmitter.emit('workQueue.userRemoved', {
          workQueueId: assignment.work_queue_id,
          userId,
          removedBy: 'SYSTEM',
          reason: 'ROLE_CHANGE',
          tenantId,
          workQueueName: assignment.workQueue.name,
          flowableGroupId: this.deriveFlowableGroupId(tenantId, assignment.workQueue.name),
        });

        this.logger.log(`Removed user ${userId} from queue ${assignment.work_queue_id} due to role change`);
      }
    }

    await this.autoAssignUsersByRole(userId, newRole, tenantId);

    this.logger.log(`Completed role change processing for user ${userId}`);
  }

  /**
   * Get work queue metrics including task counts and SLA metrics
   */
  async getWorkQueueMetrics(workQueueId: number, tenantId: string, userId?: string): Promise<WorkQueueMetricsDto> {
    const startTime = Date.now();

    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      // Log failed attempt
      if (userId) {
        await this.auditLogService.logAction({
          userId,
          operation: 'VIEW_METRICS',
          entityName: 'WorkQueue',
          actionPerformed: `Attempted to view metrics for work queue: ${workQueueId}`,
          outcome: 'FAILED - Work queue not found',
        });
      }
      throw new NotFoundException('Work queue not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        work_queue_id: workQueueId,
      },
      include: {
        case: {
          select: {
            priority: true,
            tenant_id: true,
          },
        },
      },
    });

    const tenantTasks = tasks.filter((task) => task.case.tenant_id === tenantId);

    const taskCountsByStatus = Object.values(TaskStatus).map((status) => ({
      status,
      count: tenantTasks.filter((task) => task.status === status).length,
    }));

    const now = new Date();
    let overdueCount = 0;
    let breachCount = 0;
    let atRiskCount = 0;
    let onTrackCount = 0;
    let totalCompletionTime = 0;
    let completedTasksCount = 0;
    let totalSLACompliant = 0;
    let totalWithSLA = 0;

    for (const task of tenantTasks) {
      if (task.status === TaskStatus.STATUS_30_COMPLETED && task.completed_at) {
        const completionTime = (task.completed_at.getTime() - task.created_at.getTime()) / (1000 * 60 * 60); // hours
        totalCompletionTime += completionTime;
        completedTasksCount++;

        if (task.sla_deadline) {
          totalWithSLA++;
          if (task.completed_at <= task.sla_deadline) {
            totalSLACompliant++;
          }
        }
      }

      if (task.status === TaskStatus.STATUS_30_COMPLETED) {
        continue;
      }

      if (task.sla_deadline) {
        totalWithSLA++;
        const hoursDiff = (task.sla_deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 0) {
          overdueCount++;
          breachCount++;
        } else if (hoursDiff < 24) {
          atRiskCount++;
        } else {
          onTrackCount++;
          totalSLACompliant++;
        }
      } else {
        onTrackCount++;
      }
    }

    const avgCompletionTime = completedTasksCount > 0 ? totalCompletionTime / completedTasksCount : 0;
    const complianceRate = totalWithSLA > 0 ? (totalSLACompliant / totalWithSLA) * 100 : 100;

    const assignedUserCount = await this.prisma.workQueueMember.count({
      where: {
        work_queue_id: workQueueId,
      },
    });

    const metrics = {
      workQueueId: workQueue.work_queue_id,
      workQueueName: workQueue.name,
      totalTasks: tenantTasks.length,
      activeTasks: tenantTasks.filter((t) => t.status !== TaskStatus.STATUS_30_COMPLETED).length,
      taskCountsByStatus,
      slaMetrics: {
        overdueCount,
        breachCount,
        atRiskCount,
        onTrackCount,
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
        complianceRate: Math.round(complianceRate * 10) / 10,
      },
      assignedUserCount,
      calculatedAt: new Date(),
    };

    // Log successful metrics retrieval
    if (userId) {
      const duration = Date.now() - startTime;
      await this.auditLogService.logAction({
        userId,
        operation: 'VIEW_METRICS',
        entityName: 'WorkQueue',
        actionPerformed: JSON.stringify({
          action: 'View work queue metrics',
          workQueueId,
          workQueueName: workQueue.name,
          filters: { tenantId },
          metrics: {
            totalTasks: metrics.totalTasks,
            activeTasks: metrics.activeTasks,
            overdueCount: metrics.slaMetrics.overdueCount,
            breachCount: metrics.slaMetrics.breachCount,
          },
          duration: `${duration}ms`,
        }),
        outcome: 'SUCCESS',
      });
    }

    return metrics;
  }

  /**
   * Get filtered tasks for a work queue with pagination
   */
  async getTasksByWorkQueue(workQueueId: number, filters: TaskFilterDto, tenantId: string): Promise<TaskListResponseDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException('Work queue not found');
    }

    const where: any = {
      work_queue_id: workQueueId,
      case: {
        tenant_id: tenantId,
      },
    };

    if (filters.userId) {
      where.assigned_user_id = filters.userId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.taskType) {
      where.task_type = filters.taskType;
    }

    if (filters.priority) {
      where.case = {
        ...where.case,
        priority: filters.priority,
      };
    }

    if (filters.createdAfter) {
      where.created_at = {
        ...where.created_at,
        gte: new Date(filters.createdAfter),
      };
    }

    if (filters.createdBefore) {
      where.created_at = {
        ...where.created_at,
        lte: new Date(filters.createdBefore),
      };
    }

    const total = await this.prisma.task.count({ where });

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        case: {
          select: {
            priority: true,
            tenant_id: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    });

    const now = new Date();
    const tasksWithSLA = tasks.map((task) => {
      let slaStatus: 'overdue' | 'breach' | 'on-track' | 'at-risk' | 'none' = 'none';
      let hoursUntilSLA: number | null = null;
      let isOverdue = false;
      let hasSLABreach = false;

      if (task.sla_deadline && task.status !== TaskStatus.STATUS_30_COMPLETED) {
        const hoursDiff = (task.sla_deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        hoursUntilSLA = Math.round(hoursDiff * 10) / 10;

        if (hoursDiff < 0) {
          slaStatus = 'overdue';
          isOverdue = true;
          hasSLABreach = true;
        } else if (hoursDiff < 24) {
          slaStatus = 'at-risk';
        } else {
          slaStatus = 'on-track';
        }
      }

      return {
        taskId: task.task_id,
        caseId: task.case_id,
        name: task.name || 'Untitled Task',
        description: task.description || '',
        status: task.status,
        taskType: task.task_type,
        priority: task.case.priority,
        assignedUserId: task.assigned_user_id,
        workQueueId: task.work_queue_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        isOverdue,
        hasSLABreach,
        hoursUntilSLA,
        slaStatus,
      };
    });

    let filteredTasks = tasksWithSLA;
    if (filters.slaStatus) {
      filteredTasks = tasksWithSLA.filter((task) => task.slaStatus === filters.slaStatus);
    }

    if (filters.overdueOnly) {
      filteredTasks = tasksWithSLA.filter((task) => task.isOverdue);
    }

    if (filters.slaBreachOnly) {
      filteredTasks = tasksWithSLA.filter((task) => task.hasSLABreach);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      tasks: filteredTasks,
      total: filteredTasks.length,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  /**
   * Get supervisor dashboard with aggregated metrics across all assigned work queues
   */
  async getSupervisorDashboard(userId: string, tenantId: string): Promise<SupervisorDashboardDto> {
    const startTime = Date.now();

    const workQueueAssignments = await this.prisma.workQueueMember.findMany({
      where: {
        user_id: userId,
        workQueue: {
          tenant_id: tenantId,
          is_active: true,
        },
      },
      include: {
        workQueue: true,
      },
    });

    const workQueueIds = workQueueAssignments.map((assignment) => assignment.work_queue_id);

    if (workQueueIds.length === 0) {
      return {
        supervisorId: userId,
        totalWorkQueues: 0,
        totalTasks: 0,
        totalActiveTasks: 0,
        aggregatedTaskCounts: [],
        aggregatedSLAMetrics: {
          overdueCount: 0,
          breachCount: 0,
          atRiskCount: 0,
          onTrackCount: 0,
          avgCompletionTime: 0,
          complianceRate: 100,
        },
        workQueueMetrics: [],
        totalAssignedUsers: 0,
        generatedAt: new Date(),
        refreshInterval: 60,
      };
    }

    // Get metrics for each work queue
    const workQueueMetrics = await Promise.all(workQueueIds.map((id) => this.getWorkQueueMetrics(id, tenantId)));

    const totalTasks = workQueueMetrics.reduce((sum, m) => sum + m.totalTasks, 0);
    const totalActiveTasks = workQueueMetrics.reduce((sum, m) => sum + m.activeTasks, 0);

    const statusCounts = new Map<TaskStatus, number>();
    for (const metrics of workQueueMetrics) {
      for (const statusCount of metrics.taskCountsByStatus) {
        const current = statusCounts.get(statusCount.status) || 0;
        statusCounts.set(statusCount.status, current + statusCount.count);
      }
    }

    const aggregatedTaskCounts = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    const totalOverdue = workQueueMetrics.reduce((sum, m) => sum + m.slaMetrics.overdueCount, 0);
    const totalBreach = workQueueMetrics.reduce((sum, m) => sum + m.slaMetrics.breachCount, 0);
    const totalAtRisk = workQueueMetrics.reduce((sum, m) => sum + m.slaMetrics.atRiskCount, 0);
    const totalOnTrack = workQueueMetrics.reduce((sum, m) => sum + m.slaMetrics.onTrackCount, 0);

    let totalCompletionTime = 0;
    let totalTasksWithCompletion = 0;
    let totalCompliance = 0;
    let totalQueuesWithCompliance = 0;

    for (const metrics of workQueueMetrics) {
      if (metrics.slaMetrics.avgCompletionTime > 0) {
        totalCompletionTime += metrics.slaMetrics.avgCompletionTime * metrics.totalTasks;
        totalTasksWithCompletion += metrics.totalTasks;
      }
      if (metrics.totalTasks > 0) {
        totalCompliance += metrics.slaMetrics.complianceRate;
        totalQueuesWithCompliance++;
      }
    }

    const avgCompletionTime = totalTasksWithCompletion > 0 ? Math.round((totalCompletionTime / totalTasksWithCompletion) * 10) / 10 : 0;

    const avgComplianceRate = totalQueuesWithCompliance > 0 ? Math.round((totalCompliance / totalQueuesWithCompliance) * 10) / 10 : 100;

    const allMembers = await this.prisma.workQueueMember.findMany({
      where: {
        work_queue_id: { in: workQueueIds },
      },
      select: {
        user_id: true,
      },
    });

    const uniqueUserIds = new Set(allMembers.map((m) => m.user_id));

    const dashboard = {
      supervisorId: userId,
      totalWorkQueues: workQueueIds.length,
      totalTasks,
      totalActiveTasks,
      aggregatedTaskCounts,
      aggregatedSLAMetrics: {
        overdueCount: totalOverdue,
        breachCount: totalBreach,
        atRiskCount: totalAtRisk,
        onTrackCount: totalOnTrack,
        avgCompletionTime,
        complianceRate: avgComplianceRate,
      },
      workQueueMetrics,
      totalAssignedUsers: uniqueUserIds.size,
      generatedAt: new Date(),
      refreshInterval: 60,
    };

    // Log dashboard access with comprehensive metadata
    const duration = Date.now() - startTime;
    await this.auditLogService.logAction({
      userId,
      operation: 'VIEW_DASHBOARD',
      entityName: 'SupervisorDashboard',
      actionPerformed: JSON.stringify({
        action: 'View supervisor dashboard',
        filters: {
          tenantId,
          workQueueIds: workQueueIds.length > 0 ? workQueueIds : [],
        },
        summary: {
          totalWorkQueues: dashboard.totalWorkQueues,
          totalTasks: dashboard.totalTasks,
          totalActiveTasks: dashboard.totalActiveTasks,
          overdueCount: dashboard.aggregatedSLAMetrics.overdueCount,
          breachCount: dashboard.aggregatedSLAMetrics.breachCount,
          atRiskCount: dashboard.aggregatedSLAMetrics.atRiskCount,
          complianceRate: dashboard.aggregatedSLAMetrics.complianceRate,
          totalAssignedUsers: dashboard.totalAssignedUsers,
        },
        performance: {
          duration: `${duration}ms`,
          workQueuesQueried: workQueueIds.length,
          tasksProcessed: dashboard.totalTasks,
        },
      }),
      outcome: 'SUCCESS',
    });

    return dashboard;
  }

  /**
   * Get overdue tasks for a work queue
   */
  async getOverdueTasks(workQueueId: number, tenantId: string): Promise<OverdueTaskDto[]> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException('Work queue not found');
    }

    const now = new Date();

    const tasks = await this.prisma.task.findMany({
      where: {
        work_queue_id: workQueueId,
        status: {
          not: TaskStatus.STATUS_30_COMPLETED,
        },
        sla_deadline: {
          lt: now,
        },
        case: {
          tenant_id: tenantId,
        },
      },
      include: {
        case: {
          select: {
            priority: true,
          },
        },
      },
      orderBy: {
        sla_deadline: 'asc',
      },
    });

    return tasks.map((task) => {
      const slaDeadline = task.sla_deadline as Date;
      const hoursOverdue = Math.round(((now.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60)) * 10) / 10;

      return {
        taskId: task.task_id,
        caseId: task.case_id,
        name: task.name || 'Untitled Task',
        description: task.description || '',
        status: task.status,
        taskType: task.task_type,
        priority: task.case.priority,
        assignedUserId: task.assigned_user_id,
        workQueueId: task.work_queue_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        isOverdue: true,
        hasSLABreach: true,
        hoursUntilSLA: -hoursOverdue,
        slaStatus: 'overdue' as const,
        hoursOverdue,
        expectedCompletionDate: slaDeadline,
      };
    });
  }

  /**
   * Get SLA breach tasks for a work queue
   */
  async getSLABreachTasks(workQueueId: number, tenantId: string): Promise<SLABreachTaskDto[]> {
    const overdueTasks = await this.getOverdueTasks(workQueueId, tenantId);

    return overdueTasks.map((task) => {
      const hoursPastSLA = task.hoursOverdue;
      let breachSeverity: 'minor' | 'moderate' | 'severe' | 'critical' = 'minor';

      if (hoursPastSLA > 72) {
        breachSeverity = 'critical';
      } else if (hoursPastSLA > 48) {
        breachSeverity = 'severe';
      } else if (hoursPastSLA > 24) {
        breachSeverity = 'moderate';
      }

      return {
        ...task,
        slaDeadline: task.expectedCompletionDate,
        hoursPastSLA,
        breachSeverity,
      };
    });
  }

  /**
   * Create a new assignment rule for a work queue
   */
  async createAssignmentRule(
    workQueueId: number,
    dto: CreateAssignmentRuleDto,
    userId: string,
    tenantId: string,
  ): Promise<DetailedAssignmentRuleDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    // ⚠️ RULE VALIDATION DISABLED - SHELVED FOR POST-MVP ⚠️
    // Auto-assignment rule validation is not part of MVP
    /*
    const validation = this.ruleEngine.validateRule(dto);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Rule validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    const existingRules = await this.prisma.workQueueAssignmentRule.findMany({
      where: {
        work_queue_id: workQueueId,
        is_active: true,
      },
    });

    const conflicts = this.ruleEngine.checkRuleConflicts(dto, existingRules);
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Rule conflicts detected',
        conflicts,
      });
    }
    */

    const rule = await this.prisma.workQueueAssignmentRule.create({
      data: {
        work_queue_id: workQueueId,
        rule_name: dto.ruleName,
        rule_type: AssignmentRuleType.MANUAL,
        rule_config: {},
        trigger_type: dto.triggerType,
        conditions: dto.conditions as unknown as Prisma.InputJsonValue,
        actions: dto.action as unknown as Prisma.InputJsonValue,
        stop_on_match: dto.stopOnMatch || false,
        priority_order: dto.priorityOrder,
        is_active: dto.isActive !== undefined ? dto.isActive : true,
        created_by: userId,
      },
    });

    await this.logAuditEvent(
      userId,
      'CREATE',
      'AssignmentRule',
      `Created assignment rule: ${dto.ruleName} for work queue ${workQueue.name}`,
      'SUCCESS',
    );

    this.eventEmitter.emit('rule.created', {
      ruleId: rule.assignment_rule_id,
      workQueueId,
      ruleName: dto.ruleName,
      userId,
      tenantId,
    });

    return this.mapRuleToDetailedDto(rule);
  }

  /**
   * Get all assignment rules for a work queue
   */
  async getAssignmentRules(workQueueId: number, tenantId: string, activeOnly = false): Promise<DetailedAssignmentRuleDto[]> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const rules = await this.prisma.workQueueAssignmentRule.findMany({
      where: {
        work_queue_id: workQueueId,
        ...(activeOnly && { is_active: true }),
      },
      orderBy: {
        priority_order: 'desc',
      },
    });

    return rules.map((rule) => this.mapRuleToDetailedDto(rule));
  }

  /**
   * Get a specific assignment rule by ID
   */
  async getAssignmentRuleById(workQueueId: number, ruleId: number, tenantId: string): Promise<DetailedAssignmentRuleDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const rule = await this.prisma.workQueueAssignmentRule.findFirst({
      where: {
        assignment_rule_id: ruleId,
        work_queue_id: workQueueId,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Assignment rule with ID ${ruleId} not found`);
    }

    return this.mapRuleToDetailedDto(rule);
  }

  /**
   * Update an assignment rule
   */
  async updateAssignmentRule(
    workQueueId: number,
    ruleId: number,
    dto: UpdateAssignmentRuleDto,
    userId: string,
    tenantId: string,
  ): Promise<DetailedAssignmentRuleDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const existingRule = await this.prisma.workQueueAssignmentRule.findFirst({
      where: {
        assignment_rule_id: ruleId,
        work_queue_id: workQueueId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException(`Assignment rule with ID ${ruleId} not found`);
    }

    const updateData: Prisma.WorkQueueAssignmentRuleUpdateInput = {
      updated_by: userId,
    };

    if (dto.ruleName !== undefined) {
      updateData.rule_name = dto.ruleName;
    }

    if (dto.triggerType !== undefined) {
      updateData.trigger_type = dto.triggerType;
    }

    if (dto.conditions !== undefined) {
      updateData.conditions = dto.conditions as unknown as Prisma.InputJsonValue;
    }

    if (dto.action !== undefined) {
      updateData.actions = dto.action as unknown as Prisma.InputJsonValue;
    }

    if (dto.stopOnMatch !== undefined) {
      updateData.stop_on_match = dto.stopOnMatch;
    }

    if (dto.priorityOrder !== undefined) {
      updateData.priority_order = dto.priorityOrder;
    }

    if (dto.isActive !== undefined) {
      updateData.is_active = dto.isActive;
    }

    if (dto.conditions || dto.action) {
      // RULE VALIDATION DISABLED - SHELVED FOR POST-MVP
      /*
      const validationDto: CreateAssignmentRuleDto = {
        ruleName: dto.ruleName || existingRule.rule_name,
        triggerType: (dto.triggerType || existingRule.trigger_type) as any,
        conditions: (dto.conditions || existingRule.conditions) as any,
        action: (dto.action || existingRule.actions) as any,
        priorityOrder: dto.priorityOrder || existingRule.priority_order,
        stopOnMatch: dto.stopOnMatch !== undefined ? dto.stopOnMatch : existingRule.stop_on_match,
        isActive: dto.isActive !== undefined ? dto.isActive : existingRule.is_active,
      };

      const validation = this.ruleEngine.validateRule(validationDto);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Rule validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }
      */
    }

    const updatedRule = await this.prisma.workQueueAssignmentRule.update({
      where: { assignment_rule_id: ruleId },
      data: updateData,
    });

    await this.logAuditEvent(userId, 'UPDATE', 'AssignmentRule', `Updated assignment rule: ${updatedRule.rule_name}`, 'SUCCESS');

    this.eventEmitter.emit('rule.updated', {
      ruleId,
      workQueueId,
      userId,
      tenantId,
    });

    return this.mapRuleToDetailedDto(updatedRule);
  }

  /**
   * Delete an assignment rule
   */
  async deleteAssignmentRule(workQueueId: number, ruleId: number, userId: string, tenantId: string): Promise<void> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const rule = await this.prisma.workQueueAssignmentRule.findFirst({
      where: {
        assignment_rule_id: ruleId,
        work_queue_id: workQueueId,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Assignment rule with ID ${ruleId} not found`);
    }

    await this.prisma.workQueueAssignmentRule.delete({
      where: { assignment_rule_id: ruleId },
    });

    await this.logAuditEvent(userId, 'DELETE', 'AssignmentRule', `Deleted assignment rule: ${rule.rule_name}`, 'SUCCESS');

    this.eventEmitter.emit('rule.deleted', {
      ruleId,
      workQueueId,
      userId,
      tenantId,
    });
  }

  /**
   * Activate an assignment rule
   */
  async activateRule(workQueueId: number, ruleId: number, userId: string, tenantId: string): Promise<DetailedAssignmentRuleDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const rule = await this.prisma.workQueueAssignmentRule.findFirst({
      where: {
        assignment_rule_id: ruleId,
        work_queue_id: workQueueId,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Assignment rule with ID ${ruleId} not found`);
    }

    const updatedRule = await this.prisma.workQueueAssignmentRule.update({
      where: { assignment_rule_id: ruleId },
      data: {
        is_active: true,
        updated_by: userId,
      },
    });

    await this.logAuditEvent(userId, 'ACTIVATE', 'AssignmentRule', `Activated assignment rule: ${rule.rule_name}`, 'SUCCESS');

    this.eventEmitter.emit('rule.activated', {
      ruleId,
      workQueueId,
      userId,
      tenantId,
    });

    return this.mapRuleToDetailedDto(updatedRule);
  }

  /**
   * Deactivate an assignment rule
   */
  async deactivateRule(workQueueId: number, ruleId: number, userId: string, tenantId: string): Promise<DetailedAssignmentRuleDto> {
    const workQueue = await this.prisma.workQueue.findFirst({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
    });

    if (!workQueue) {
      throw new NotFoundException(`Work queue with ID ${workQueueId} not found`);
    }

    const rule = await this.prisma.workQueueAssignmentRule.findFirst({
      where: {
        assignment_rule_id: ruleId,
        work_queue_id: workQueueId,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Assignment rule with ID ${ruleId} not found`);
    }

    const updatedRule = await this.prisma.workQueueAssignmentRule.update({
      where: { assignment_rule_id: ruleId },
      data: {
        is_active: false,
        updated_by: userId,
      },
    });

    await this.logAuditEvent(userId, 'DEACTIVATE', 'AssignmentRule', `Deactivated assignment rule: ${rule.rule_name}`, 'SUCCESS');

    this.eventEmitter.emit('rule.deactivated', {
      ruleId,
      workQueueId,
      userId,
      tenantId,
    });

    return this.mapRuleToDetailedDto(updatedRule);
  }

  /**
   * Map WorkQueueAssignmentRule to DetailedAssignmentRuleDto
   */
  /**
   * Get all active assignment rules for a tenant (for auto-assignment during task creation)
   */
  async getAllActiveAssignmentRules(tenantId: string): Promise<WorkQueueAssignmentRule[]> {
    return this.prisma.workQueueAssignmentRule.findMany({
      where: {
        is_active: true,
        workQueue: {
          tenant_id: tenantId,
          is_active: true,
        },
      },
      orderBy: {
        priority_order: 'desc',
      },
    });
  }

  /**
   * Helper method to map Prisma rule to DetailedAssignmentRuleDto
   */
  private mapRuleToDetailedDto(rule: any): DetailedAssignmentRuleDto {
    return {
      ruleId: rule.assignment_rule_id,
      workQueueId: rule.work_queue_id,
      ruleName: rule.rule_name,
      triggerType: rule.trigger_type,
      conditions: rule.conditions,
      action: rule.actions,
      priorityOrder: rule.priority_order,
      stopOnMatch: rule.stop_on_match,
      isActive: rule.is_active,
      applicationCount: rule.application_count,
      lastAppliedAt: rule.last_applied_at,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
      createdBy: rule.created_by,
      updatedBy: rule.updated_by,
    };
  }
}
