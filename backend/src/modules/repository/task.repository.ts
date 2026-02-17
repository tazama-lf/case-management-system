import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, TaskStatus, CaseStatus } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class TaskRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  /* ------------------------------ Task Queries ------------------------------ */
  async findTaskById(taskId: number, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.task.findUnique({ where: { task_id: taskId } });
  }

  async findTaskWithCase(taskId: number, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const task = await client.task.findUnique({
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

      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      return task;
    } catch (error) {
      throw error;
    }
  }

  async findTasks(where: Prisma.TaskWhereInput, includeCase: boolean, skip?: number, take?: number, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.task.findMany({
      where,
      include: includeCase
        ? {
            case: {
              select: { case_id: true, status: true, priority: true, created_at: true, case_type: true },
            },
          }
        : undefined,
      skip,
      take,
      orderBy: { created_at: 'desc' },
    });
  }

  async countTasks(where: Prisma.TaskWhereInput, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.task.count({ where });
  }

  async createTask(data: Prisma.TaskCreateInput, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    const createdTask = await client.task.create({ data });
    if (!createdTask) throw new Error('Failed to create task');
    return createdTask;
  }

  async updateTask(taskId: number, data: Prisma.TaskUpdateInput, tx?: Prisma.TransactionClient, includeCase = false) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.task.update({ where: { task_id: taskId }, data, include: includeCase ? { case: true } : undefined });
  }

  /* ------------------------------ Case Queries ------------------------------ */
  async findCaseBasic(caseId: number, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.case.findUnique({
      where: { case_id: caseId },
      select: { tenant_id: true, priority: true, status: true },
    });
  }

  async findCaseStatus(caseId: number, tx?: Prisma.TransactionClient) {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
      const caseStatus = await client.case.findUnique({ where: { case_id: caseId }, select: { status: true, case_owner_user_id: true } });
      if (!caseStatus) throw new NotFoundException(`Case ${caseId} not found`);
      return caseStatus;
    } catch (error) {
      throw error;
    }
  }

  async updateCase(caseId: number, data: Prisma.CaseUpdateInput, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return client.case.update({ where: { case_id: caseId }, data });
  }

  /* --------------------------- Work Queue / Groups -------------------------- */
  // async findMatchingWorkQueue(tenantId: string, candidateGroup: string, tx?: Prisma.TransactionClient) {
  //   const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
  //   return client.workQueue.findFirst({
  //     where: {
  //       tenant_id: tenantId,
  //       is_active: true,
  //       OR: [
  //         { name: { contains: candidateGroup, mode: 'insensitive' } },
  //         {
  //           roles: {
  //             some: {
  //               role: candidateGroup.toUpperCase() as any,
  //             },
  //           },
  //         },
  //       ],
  //     },
  //   });
  // }

  // async findWorkQueue(queueId: number, tx?: Prisma.TransactionClient) {
  //   const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
  //   return client.workQueue.findUnique({
  //     where: { work_queue_id: queueId },
  //     select: { work_queue_id: true, name: true, tenant_id: true, is_active: true },
  //   });
  // }

  // async findWorkQueueMember(workQueueId: number, userId: string, tx?: Prisma.TransactionClient) {
  //   const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
  //   return client.workQueueMember.findUnique({
  //     where: { work_queue_id_user_id: { work_queue_id: workQueueId, user_id: userId } },
  //   });
  // }

  /* -------------------------- Lifecycle Transactions ------------------------ */
  async assignTaskAndUpdateCase(taskId: number, assignedUserId: string) {
    return this.transaction(async (tx) => {
      const task = await this.findTaskById(taskId, tx);
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
}
