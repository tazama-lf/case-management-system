import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, TaskStatus, CaseStatus, Task, Case, Priority } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class TaskRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  /* ------------------------------ Task Queries ------------------------------ */
  async findTaskById(taskId: number, tenantId: string, tx?: Prisma.TransactionClient): Promise<Task | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const task = await client.task.findUnique({
      where: {
        task_id: taskId,
        tenant_id: tenantId,
      },
    });
    return task;
  }

  async findTaskWithCase(
    taskId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<
    | (Task & {
        case: {
          case_id: number;
          status: CaseStatus;
          case_owner_user_id: string | null;
          priority: Priority;
          created_at: Date;
        } | null;
        comments: Array<{
          task_id: number | null;
          case_id: number | null;
          tenant_id: string;
          created_at: Date;
          updated_at: Date;
          comment_id: number;
          user_id: string;
          note: string;
        }>;
      })
    | null
  > {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const task = await client.task.findUnique({
      where: {
        task_id: taskId,
        tenant_id: tenantId,
      },
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
  }

  async findTasks(
    where: Prisma.TaskWhereInput,
    tenantId: string,
    includeCase: boolean,
    skip?: number,
    take?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Task[]> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.findMany({
      where: {
        ...where,
        tenant_id: tenantId,
      },
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

  async countTasks(where: Prisma.TaskWhereInput, tenantId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.count({
      where: {
        ...where,
        tenant_id: tenantId,
      },
    });
  }

  async createTask(data: Prisma.TaskCreateInput, tx?: Prisma.TransactionClient): Promise<Task | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const createdTask = await client.task.create({ data });
    return createdTask;
  }

  async updateTask(taskId: number, data: Prisma.TaskUpdateInput, tx?: Prisma.TransactionClient, includeCase = false): Promise<Task> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.update({ where: { task_id: taskId }, data, include: includeCase ? { case: true } : undefined });
  }

  /* ------------------------------ Case Queries ------------------------------ */
  async findCaseBasic(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ tenant_id: string; priority: Priority; status: CaseStatus } | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      select: { tenant_id: true, priority: true, status: true },
    });
  }

  async findCaseStatus(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ status: CaseStatus; case_owner_user_id: string | null } | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const caseRecord = await client.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      select: { status: true, case_owner_user_id: true },
    });
    return caseRecord;
  }

  async updateCase(caseId: number, data: Prisma.CaseUpdateInput, tx?: Prisma.TransactionClient): Promise<Case> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.case.update({ where: { case_id: caseId }, data });
  }

  /* -------------------------- Lifecycle Transactions ------------------------ */
  async assignTaskAndUpdateCase(
    taskId: number,
    tenantId: string,
    assignedUserId: string,
  ): Promise<{ taskBefore: Task; updatedTask: Task; previousCaseStatus: CaseStatus }> {
    return await this.transaction(async (tx) => {
      const task = await this.findTaskById(taskId, tenantId, tx);
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      const caseRecord = await this.findCaseStatus(task.case_id, tenantId, tx);
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

  async unassignTaskAndUpdateCase(
    taskId: number,
    tenantId: string,
  ): Promise<{ taskBefore: Task; updatedTask: Task; previousCaseStatus: CaseStatus }> {
    return await this.transaction(async (tx) => {
      const task = await this.findTaskById(taskId, tenantId, tx);
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      if (task.status === TaskStatus.STATUS_30_COMPLETED) throw new BadRequestException(`Cannot unassign completed task ${taskId}`);
      if (!task.assigned_user_id) throw new BadRequestException(`Task ${taskId} already unassigned`);
      const caseRecord = await this.findCaseStatus(task.case_id, tenantId, tx);
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

  async releaseTask(taskId: number, tenantId: string): Promise<Task> {
    const task = await this.findTaskById(taskId, tenantId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return await this.updateTask(taskId, { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED }, undefined, true);
  }

  async completeTask(taskId: number, tenantId: string): Promise<Task> {
    const task = await this.findTaskById(taskId, tenantId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return await this.updateTask(taskId, { status: TaskStatus.STATUS_30_COMPLETED }, undefined, true);
  }
}
