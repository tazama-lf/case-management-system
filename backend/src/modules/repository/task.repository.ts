import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, TaskStatus, CaseStatus } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class TaskRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async findTaskById(taskId: number) {
    return this.prisma.task.findUnique({ where: { task_id: taskId } });
  }

  async findTaskWithCase(taskId: number) {
    return this.prisma.task.findUnique({
      where: { task_id: taskId },
      include: {
        case: {
          select: {
            case_id: true,
            status: true,
            case_owner_user_id: true,
            priority: true,
            created_at: true,
          },
        },
        comments: { orderBy: { created_at: 'desc' } },
      },
    });
  }

  async findTasks(where: Prisma.TaskWhereInput, includeCase: boolean, skip?: number, take?: number) {
    return this.prisma.task.findMany({
      where,
      include: includeCase
        ? {
            case: {
              select: { case_id: true, status: true, priority: true, created_at: true, case_type: true },
            },
            workQueue: { include: { roles: true } },
          }
        : undefined,
      skip,
      take,
      orderBy: { created_at: 'desc' },
    });
  }

  async countTasks(where: Prisma.TaskWhereInput) {
    return this.prisma.task.count({ where });
  }

  async createTask(data: Prisma.TaskCreateInput, tx?: Prisma.TransactionClient) {
    if (tx) return tx.task.create({ data });
    const createdTask = await this.prisma.task.create({ data });
    if (!createdTask) throw new Error('Failed to create task');
    return createdTask;
  }

  async updateTask(taskId: number, data: Prisma.TaskUpdateInput, tx?: Prisma.TransactionClient, includeCase = false) {
    if (tx)
      return tx.task.update({
        where: { task_id: taskId },
        data,
        include: includeCase ? { case: true } : undefined,
      });
    return this.prisma.task.update({ where: { task_id: taskId }, data, include: includeCase ? { case: true } : undefined });
  }

  /* ------------------------------ Case Queries ------------------------------ */
  async findCaseBasic(caseId: string, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.case.findUnique({
      where: { case_id: caseId },
      select: { tenant_id: true, priority: true, status: true },
    });
  }

  async findCaseStatus(caseId: number, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.case.findUnique({ where: { case_id: caseId }, select: { status: true, case_owner_user_id: true } });
  }

  async updateCase(caseId: number, data: Prisma.CaseUpdateInput, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.case.update({ where: { case_id: caseId }, data });
  }

  /* --------------------------- Work Queue / Groups -------------------------- */
  async findMatchingWorkQueue(tenantId: string, candidateGroup: string, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.workQueue.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { name: { contains: candidateGroup, mode: 'insensitive' } },
          {
            roles: {
              some: {
                role: candidateGroup.toUpperCase() as any,
              },
            },
          },
        ],
      },
    });
  }

  async findWorkQueue(queueId: number, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.workQueue.findUnique({
      where: { work_queue_id: queueId },
      select: { work_queue_id: true, name: true, tenant_id: true, is_active: true },
    });
  }

  async findWorkQueueMember(workQueueId: number, userId: string, tx?: Prisma.TransactionClient) {
    const client: any = tx || this.prisma;
    return client.workQueueMember.findUnique({
      where: { work_queue_id_user_id: { work_queue_id: workQueueId, user_id: userId } },
    });
  }

  /* -------------------------- Lifecycle Transactions ------------------------ */
  async assignTaskAndUpdateCase(taskId: number, assignedUserId: string) {
    return this.transaction(async (tx) => {
      const task = await this.findTaskById(taskId);
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      const caseRecord = await this.findCaseStatus(task.case_id, tx);
      if (!caseRecord) throw new NotFoundException(`Case ${task.case_id} not found`);
      const updatedTask = await this.updateTask(
        taskId,
        { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
        tx,
      );
      await this.updateCase(
        task.case_id,
        { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
        tx,
      );
      return { taskBefore: task, updatedTask, previousCaseStatus: caseRecord.status };
    });
  }

  async unassignTaskAndUpdateCase(taskId: number) {
    return this.transaction(async (tx) => {
      const task = await this.findTaskById(taskId);
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      if (task.status === TaskStatus.STATUS_30_COMPLETED) throw new BadRequestException(`Cannot unassign completed task ${taskId}`);
      if (!task.assigned_user_id) throw new BadRequestException(`Task ${taskId} already unassigned`);
      const caseRecord = await this.findCaseStatus(task.case_id, tx);
      if (!caseRecord) throw new NotFoundException(`Case ${task.case_id} not found`);
      const updatedTask = await this.updateTask(taskId, { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED }, tx);
      await this.updateCase(
        task.case_id,
        { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, case_owner_user_id: null, updated_at: new Date() },
        tx,
      );
      return { taskBefore: task, updatedTask, previousCaseStatus: caseRecord.status };
    });
  }

  async releaseTask(taskId: number) {
    const task = await this.findTaskById(taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return this.updateTask(taskId, { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED }, undefined, true);
  }

  async completeTask(taskId: number) {
    const task = await this.findTaskById(taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return this.updateTask(taskId, { status: TaskStatus.STATUS_30_COMPLETED }, undefined, true);
  }

  async reassignToWorkQueue(taskId: number, targetWorkQueueId: number, tenantId: string, reason?: string, assignedUserId?: string) {
    return this.transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { task_id: taskId },
        include: {
          workQueue: { select: { work_queue_id: true, name: true } },
          case: { select: { case_id: true, tenant_id: true, status: true } },
        },
      });
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      if (task.case.tenant_id !== tenantId) throw new ForbiddenException('Task does not belong to your organization');
      if (task.status === TaskStatus.STATUS_20_IN_PROGRESS && task.assigned_user_id)
        throw new BadRequestException('Cannot reassign in-progress task');
      const targetQueue = await this.findWorkQueue(targetWorkQueueId, tx);
      if (!targetQueue) throw new NotFoundException(`Target work queue ${targetWorkQueueId} not found`);
      if (targetQueue.tenant_id !== tenantId) throw new ForbiddenException('Target work queue does not belong to your organization');
      if (!targetQueue.is_active) throw new BadRequestException(`Target work queue '${targetQueue.name}' is not active`);
      if (task.work_queue_id === targetWorkQueueId) throw new BadRequestException(`Task already in '${targetQueue.name}'`);
      if (assignedUserId) {
        const membership = await this.findWorkQueueMember(targetWorkQueueId, assignedUserId, tx);
        if (!membership) throw new BadRequestException(`User ${assignedUserId} not in target work queue '${targetQueue.name}'`);
      }
      const updateData: any = { work_queue_id: targetWorkQueueId, updated_at: new Date() };
      if (assignedUserId) {
        updateData.assigned_user_id = assignedUserId;
        updateData.status = TaskStatus.STATUS_10_ASSIGNED;
      } else if (task.assigned_user_id) {
        updateData.assigned_user_id = null;
        updateData.status = TaskStatus.STATUS_01_UNASSIGNED;
      }
      const updatedTask = await this.updateTask(taskId, updateData, tx);
      return { task, updatedTask, targetQueue, reason };
    });
  }

  /* ---------------------------- Creation Workflow --------------------------- */
  // async createTaskWithAutoAssign(dto: { caseId: string; name: string; description?: string; candidateGroup?: string; status?: TaskStatus; assignedUserId?: string }) {
  // 	return this.transaction(async (tx) => {
  // 		const caseData = await this.findCaseBasic(dto.caseId, tx);
  // 		if (!caseData) throw new NotFoundException(`Case ${dto.caseId} not found`);
  // 		let workQueueId: string | undefined;
  // 		let matchingQueue: any = null;
  // 		let derivedFlowableGroupId: string | undefined;
  // 		if (dto.candidateGroup) {
  // 			try {
  // 				matchingQueue = await this.findMatchingWorkQueue(caseData.tenant_id, dto.candidateGroup, tx);
  // 				if (matchingQueue) {
  // 					workQueueId = matchingQueue.work_queue_id;
  // 					const normalizedQueueName = matchingQueue.name
  // 						.trim()
  // 						.toLowerCase()
  // 						.replace(/[^a-z0-9]+/g, '-')
  // 						.replace(/^-+|-+$/g, '')
  // 						.slice(0, 50);
  // 					derivedFlowableGroupId = `tenant-${caseData.tenant_id}__queue-${normalizedQueueName}`;
  // 				}
  // 			} catch (e) {
  // 				// swallow; logging handled at service layer
  // 			}
  // 		}
  // 		const taskData: Prisma.TaskCreateInput = {
  // 			case: { connect: { case_id: dto.caseId } },
  // 			status: dto.status || TaskStatus.STATUS_01_UNASSIGNED,
  // 			name: dto.name,
  // 			description: dto.description,
  // 			candidateGroup: dto.candidateGroup,
  // 		};
  // 		if (dto.assignedUserId) taskData.assigned_user_id = dto.assignedUserId;
  // 		if (workQueueId) taskData.workQueue = { connect: { work_queue_id: workQueueId } };
  // 		const task = await this.createTask(taskData, tx);
  // 		return { task, tenantId: caseData.tenant_id, caseData, workQueueId, matchingQueue, derivedFlowableGroupId };
  // 	});
  // }
}
