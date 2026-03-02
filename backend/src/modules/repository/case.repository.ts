import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseStatus, TaskStatus, Prisma, Case, Alert, Task, Priority, CaseType } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';
import { CommentRepository } from './comment.repository';
import { validate as isUuid } from 'uuid';
import { CaseClosureOutcome } from 'src/utils/enums/case-enum';

@Injectable()
export class CaseRepository extends BaseRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commentRepository: CommentRepository,
    private readonly logger: Logger,
  ) {
    super(prisma);
  }

  async findAlert(alertId: number, tenantId: string, tx?: Prisma.TransactionClient): Promise<Alert | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.alert.findUnique({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });
  }

  async updateAlertByAlertId(dto, priorityScore, createdCase, priority, tx?: Prisma.TransactionClient): Promise<Alert> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.alert.update({
      where: { alert_id: dto.alertId },
      data: {
        priority,
        alert_type: dto.alertType,
        priority_score: priorityScore,
        case_id: createdCase.case_id,
      },
    });
  }

  async findCaseWithApprovalTask(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<(Case & { tasks: Task[] }) | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Creation',
          },
        },
        alert: {
          select: {
            alert_id: true,
            alert_type: true,
          },
        },
      },
    });
  }

  async findCaseBasicInfo(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ case_id: number; status: CaseStatus; case_creator_user_id: string; priority: string; case_type: string | null } | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      select: {
        case_id: true,
        status: true,
        case_creator_user_id: true,
        priority: true,
        case_type: true,
      },
    });
  }

  // Task finder methods - using specific implementations for type safety
  async findTaskByNameAndStatus(
    caseId: number,
    tenantId: string,
    taskName: string,
    status: TaskStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Task | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.findFirst({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
        name: taskName,
        status,
      },
    });
  }

  async findTaskByNames(
    caseId: number,
    tenantId: string,
    names: string[],
    status: TaskStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Task | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.findFirst({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
        name: { in: names },
        status,
      },
    });
  }

  // Reopening task queries - all return task with comments
  async findReopeningTaskWithComments(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<(Task & { comments: Array<{ comment_id: number; note: string; created_at: Date }> }) | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.task.findFirst({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
        name: 'Approve Case Reopening',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      },
      include: {
        comments: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findUnassignedTaskForReopening(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<(Task & { comments: Array<{ comment_id: number; note: string; created_at: Date }> }) | null> {
    return await this.findReopeningTaskWithComments(caseId, tenantId, tx);
  }

  async findReopeningTaskForRejection(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<(Task & { comments: Array<{ comment_id: number; note: string; created_at: Date }> }) | null> {
    return await this.findReopeningTaskWithComments(caseId, tenantId, tx);
  }

  async findCaseWithPermissionCheck(
    caseId: number,
    tenantId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<
    (Case & { tasks: Task[]; alert: Alert | null; comments: Array<{ comment_id: number; note: string; created_at: Date }> }) | null
  > {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;

    // Check if userId is a valid UUID
    const isValidUuid = isUuid(userId);
    // Build the where condition based on whether userId is a valid UUID
    const whereCondition: Prisma.CaseWhereInput = {
      case_id: caseId,
      tenant_id: tenantId,
    };

    // Only add UUID-based permission checks if userId is a valid UUID
    // Otherwise, PostgreSQL will throw an error when trying to parse userId as UUID
    if (isValidUuid) {
      whereCondition.OR = [
        {
          case_type: {
            in: ['FRAUD_AND_AML'],
          },
        },
        {
          AND: [
            {
              case_type: {
                notIn: ['FRAUD_AND_AML'],
              },
            },
            {
              OR: [
                { case_owner_user_id: userId },
                {
                  tasks: {
                    some: {
                      assigned_user_id: userId,
                      name: {
                        in: ['Investigate Case', 'Investigate case', 'investigate case'],
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ];
    } else {
      // If userId is not a valid UUID, skip UUID column comparisons
      // Permission enforcement will be done at service layer through task assignment checks
      this.logger.log(
        `[findCaseWithPermissionCheck] Invalid UUID userId detected: ${userId}. Skipping UUID-based permission checks.`,
        CaseRepository.name,
      );
      //console.log(`[findCaseWithPermissionCheck] Non-UUID userId detected: ${userId}. Skipping UUID-based permission checks.`);
      // Just return the case by caseId and tenantId (tenant isolation is still enforced)
    }

    return await client.case.findFirst({
      where: whereCondition,
      include: {
        tasks: true,
        alert: true,
        comments: true,
      },
    });
  }
  async findCaseForReopening(caseId: number, tenantId: string): Promise<(Case & { tasks: Task[] }) | null> {
    return await this.prisma.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Reopening',
          },
        },
      },
    });
  }

  async findCaseForClosureApproval(
    caseId: number,
    tenantId: string,
  ): Promise<
    | (Case & {
        tasks: Task[];
        alert: Alert | null;
        comments: Array<{
          case_id: number | null;
          tenant_id: string;
          created_at: Date;
          updated_at: Date;
          task_id: number | null;
          comment_id: number;
          user_id: string;
          note: string;
        }>;
      })
    | null
  > {
    return await this.prisma.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: {
        tasks: true,
        alert: true,
        comments: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
    });
  }

  async findCaseForReview(caseId: number, tenantId: string): Promise<(Case & { tasks: Task[] }) | null> {
    return await this.prisma.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: {
        tasks: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  async findCaseById(
    caseId: number,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ alert: Alert | null; tasks: Task[] } & Case> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const caseData = await client.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: { alert: true, tasks: true },
    });
    if (!caseData) {
      throw new NotFoundException('Case Not Found');
    }
    return caseData;
  }

  async updateCase(caseId: number, data: Prisma.CaseUpdateInput, tx?: Prisma.TransactionClient): Promise<Case> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.case.update({
      where: { case_id: caseId },
      data,
    });
  }

  async executeTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(fn);
  }

  getTransactionClient(): PrismaService {
    return this.prisma;
  }

  async findOldestUnassignedCase(tenantId: string): Promise<{ case_id: number; created_at: Date } | null> {
    return await this.prisma.case.findFirst({
      where: {
        case_owner_user_id: null,
        tenant_id: tenantId,
      },
      orderBy: { created_at: 'asc' },
      select: { case_id: true, created_at: true },
    });
  }

  async countCasesWithFilters(whereClause: Prisma.CaseWhereInput, tenantId: string): Promise<number> {
    return await this.prisma.case.count({
      where: {
        ...whereClause,
        tenant_id: tenantId,
      },
    });
  }

  async findCasesWithFilters(
    whereClause: Prisma.CaseWhereInput,
    tenantId: string,
    options: { skip: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<
    Array<
      Case & {
        tasks: Array<{
          task_id: number;
          status: TaskStatus;
          assigned_user_id: string | null;
          name: string | null;
        }>;
        alert: {
          alert_id: number;
          message: string;
          confidence_per: number;
          alert_type: CaseType | null;
          transaction: Prisma.JsonValue;
        } | null;
      }
    >
  > {
    return await this.prisma.case.findMany({
      where: {
        ...whereClause,
        tenant_id: tenantId,
      },
      include: {
        tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true } },
        alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true, transaction: true } },
      },
      skip: options.skip,
      take: options.limit,
      orderBy: { [options.sortBy]: options.sortOrder },
    });
  }

  async CountWithOrConditions(whereConditions: Prisma.CaseWhereInput[], tenantId: string): Promise<number> {
    return await this.prisma.case.count({
      where: {
        tenant_id: tenantId,
        OR: whereConditions,
      },
    });
  }

  async findCasesWithOrConditions(
    whereConditions: Prisma.CaseWhereInput[],
    tenantId: string,
    options: { skip: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<
    Array<
      Case & {
        tasks: Task[];
        alert: {
          priority: Priority | null;
          alert_id: number;
          alert_type: CaseType | null;
          message: string;
          transaction: Prisma.JsonValue;
          confidence_per: number;
        } | null;
        comments: Array<{
          comment_id: number;
          created_at: Date;
        }>;
      }
    >
  > {
    return await this.prisma.case.findMany({
      where: {
        tenant_id: tenantId,
        OR: whereConditions,
      },
      include: {
        tasks: { orderBy: { created_at: 'desc' } },
        alert: { select: { alert_id: true, message: true, confidence_per: true, priority: true, alert_type: true, transaction: true } },
        comments: { select: { comment_id: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 1 },
      },
      skip: options.skip,
      take: options.limit,
      orderBy: { [options.sortBy]: options.sortOrder },
    });
  }

  // Generic count method
  async countCases(whereClause: Prisma.CaseWhereInput, tenantId: string): Promise<number> {
    return await this.prisma.case.count({
      where: {
        ...whereClause,
        tenant_id: tenantId,
      },
    });
  }

  // Specialized count methods for common queries
  async countOwnedCases(userId: string, tenantId: string): Promise<number> {
    return await this.countCases({ case_owner_user_id: userId }, tenantId);
  }

  async countCasesWithTaskAssignments(userId: string, tenantId: string): Promise<number> {
    return await this.countCases({ tasks: { some: { assigned_user_id: userId } } }, tenantId);
  }

  async countUnassignedCases(tenantId: string): Promise<number> {
    return await this.countCases({ case_owner_user_id: null }, tenantId);
  }

  async findCaseWithCompletedInvestigation(caseId: number, tenantId: string): Promise<(Case & { tasks: Task[] }) | null> {
    return await this.prisma.case.findUnique({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      include: {
        tasks: {
          where: {
            name: { in: ['Investigate Case', 'Investigate case'] },
            status: TaskStatus.STATUS_30_COMPLETED,
          },
          orderBy: { updated_at: 'desc' },
        },
      },
    });
  }

  async countActiveCases(userId: string, tenantId: string): Promise<number> {
    return await this.prisma.case.count({
      where: {
        tenant_id: tenantId,
        OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
        status: {
          notIn: [
            CaseStatus.STATUS_81_CLOSED_REFUTED,
            CaseStatus.STATUS_82_CLOSED_CONFIRMED,
            CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
            CaseStatus.STATUS_99_ABANDONED,
          ],
        },
      },
    });
  }

  async countPendingTasks(userId: string, tenantId: string): Promise<number> {
    return await this.prisma.task.count({
      where: {
        assigned_user_id: userId,
        tenant_id: tenantId,
        status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] },
      },
    });
  }

  async findAllUserActiveCases(
    userId: string,
    tenantId: string,
  ): Promise<Array<{ case_id: number; status: CaseStatus; priority: string; created_at: Date }>> {
    return await this.prisma.case.findMany({
      where: {
        tenant_id: tenantId,
        OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
        status: {
          notIn: [
            CaseStatus.STATUS_81_CLOSED_REFUTED,
            CaseStatus.STATUS_82_CLOSED_CONFIRMED,
            CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
            CaseStatus.STATUS_99_ABANDONED,
          ],
        },
      },
      select: { case_id: true, status: true, priority: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });
  }

  async createCase(caseDetail: any, tx?: Prisma.TransactionClient): Promise<Case> {
    const prisma = tx ?? this.prisma;
    return await prisma.case.create({
      data: {
        tenant_id: caseDetail.tenantId,
        case_creator_user_id: caseDetail.caseCreatorUserId,
        case_owner_user_id: caseDetail.caseOwnerUserId,
        status: caseDetail.status,
        priority: caseDetail.priority,
        case_type: caseDetail.caseType,
        case_creation_type: caseDetail.caseCreationType,
        parent_id: caseDetail.parentId,
      },
    });
  }

  async createDraftCase(caseDetail: any, dto: any, priorityScore: number, priority: any): Promise<{ case: Case; alert: Alert }> {
    return await this.prisma.$transaction(async (prisma) => {
      // Create case in PostgreSQL only (no BPMN workflow)
      const createdCase = await prisma.case.create({
        data: {
          tenant_id: caseDetail.tenantId,
          case_creator_user_id: caseDetail.caseCreatorUserId,
          case_owner_user_id: caseDetail.caseOwnerUserId,
          status: caseDetail.status,
          priority: caseDetail.priority,
          case_type: caseDetail.caseType,
          case_creation_type: caseDetail.caseCreationType,
        },
      });

      // Update alert within the same transaction
      const updatedAlert = await prisma.alert.update({
        where: { alert_id: dto.alertId },
        data: {
          priority,
          alert_type: dto.alertType,
          priority_score: priorityScore,
          case_id: createdCase.case_id,
        },
      });

      return { case: createdCase, alert: updatedAlert };
    });
  }

  async updateCaseStatusAndCompleteTask(
    caseId: number,
    status: CaseStatus,
    investigationTaskId: number | undefined,
    userId: string,
    finalOutcome?: CaseClosureOutcome,
    comment?: { note: string; taskId?: number; tenantId: string },
  ): Promise<{ updatedCase: Case; completedTask?: Task }> {
    const txResult = await this.prisma.$transaction(async (tx) => {
      // First get the case to verify tenant_id
      const existingCase = await tx.case.findUnique({
        where: { case_id: caseId },
        select: { tenant_id: true },
      });

      if (!existingCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Verify tenant_id matches if comment has tenantId
      if (comment && existingCase.tenant_id !== comment.tenantId) {
        throw new Error(`Tenant mismatch for case ${caseId}: expected ${existingCase.tenant_id}, got ${comment.tenantId}`);
      }

      const updatedCase = await tx.case.update({
        where: { case_id: caseId },
        data: { status, final_outcome: finalOutcome, updated_at: new Date() },
      });

      if (investigationTaskId) {
        // Verify task belongs to same tenant
        const existingTask = await tx.task.findUnique({
          where: { task_id: investigationTaskId },
          select: { tenant_id: true },
        });

        if (!existingTask) {
          throw new Error(`Task ${investigationTaskId} not found`);
        }

        if (existingTask.tenant_id !== existingCase.tenant_id) {
          throw new Error(
            `Task ${investigationTaskId} tenant_id (${existingTask.tenant_id}) does not match case ${caseId} tenant_id (${existingCase.tenant_id})`,
          );
        }

        await tx.task.update({
          where: { task_id: investigationTaskId },
          data: { status: TaskStatus.STATUS_30_COMPLETED, updated_at: new Date() },
        });
      }

      if (comment) {
        await this.commentRepository.createComment(
          userId,
          {
            caseId,
            taskId: comment.taskId,
            note: comment.note,
            tenantId: comment.tenantId,
          },
          tx,
        );
      }
      return { updatedCase };
    });
    return txResult;
  }

  async approveClosureTask(
    caseId: number,
    taskId: number,
    status: CaseStatus,
    supervisorId: string,
    tenantId: string,
    comments?: string,
  ): Promise<{ updatedCase: Case; completedTask: Task }> {
    return await this.prisma.$transaction(async (tx) => {
      // Verify case belongs to the tenant
      const existingCase = await tx.case.findUnique({
        where: { case_id: caseId },
        select: { tenant_id: true },
      });

      if (!existingCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      if (existingCase.tenant_id !== tenantId) {
        throw new Error(`Case ${caseId} does not belong to tenant ${tenantId}`);
      }

      const updatedCase = await tx.case.update({
        where: { case_id: caseId },
        data: { status, updated_at: new Date(), final_outcome: status },
      });

      // Verify task belongs to same tenant
      const existingTask = await tx.task.findUnique({
        where: { task_id: taskId },
        select: { tenant_id: true },
      });

      if (existingTask && existingTask.tenant_id !== tenantId) {
        throw new Error(`Task ${taskId} does not belong to tenant ${tenantId}`);
      }

      const completedTask = await tx.task.update({
        where: { task_id: taskId },
        data: {
          status: TaskStatus.STATUS_30_COMPLETED,
          assigned_user_id: supervisorId,
          updated_at: new Date(),
        },
      });

      await tx.comment.create({
        data: {
          user_id: supervisorId,
          tenant_id: tenantId,
          task_id: taskId,
          note: comments
            ? `Supervisor Approval:\n${comments}\n\nFinal Outcome: ${status}`
            : `Case closure approved with outcome: ${status}`,
        },
      });

      return { updatedCase, completedTask };
    });
  }

  async rejectClosureTask(
    caseId: number,
    supervisorId: string,
    originalInvestigatorId: string,
    comments: string,
    taskNames: { APPROVE_CASE_CLOSURE: string; APPROVE_CASE_CLOSURE_LOWER: string; INVESTIGATE_CASE: string },
    tenantId: string,
  ): Promise<{ updatedCase: Case; completedTask: Task; newInvestigationTask: Task }> {
    return await this.prisma.$transaction(async (tx) => {
      // Find approval task first
      const approvalTask = await tx.task.findFirst({
        where: {
          case_id: caseId,
          name: { in: [taskNames.APPROVE_CASE_CLOSURE, taskNames.APPROVE_CASE_CLOSURE_LOWER] },
          assigned_user_id: supervisorId,
          status: {
            in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
          },
        },
      });

      if (!approvalTask) {
        throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
      }

      // Complete the approval task
      const completedTask = await tx.task.update({
        where: { task_id: approvalTask.task_id },
        data: {
          status: TaskStatus.STATUS_30_COMPLETED,
          assigned_user_id: supervisorId,
          updated_at: new Date(),
        },
      });

      const newInvestigationTask = await tx.task.create({
        data: {
          case_id: caseId,
          tenant_id: tenantId,
          name: taskNames.INVESTIGATE_CASE,
          description: 'Continue investigation based on supervisor feedback. Previous closure was rejected.',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assigned_user_id: originalInvestigatorId,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Add supervisor feedback as comment on new investigation task
      await this.commentRepository.createComment(
        supervisorId,
        {
          caseId,
          taskId: newInvestigationTask.task_id,
          note: `Supervisor Feedback:\n${comments}\n\nAction Required: Address the concerns raised and resubmit it.`,
          tenantId,
        },
        tx,
      );

      // Update case status LAST to prevent BPMN from overriding it
      const updatedCase = await tx.case.update({
        where: { case_id: caseId },
        data: {
          status: CaseStatus.STATUS_20_IN_PROGRESS,
          updated_at: new Date(),
        },
      });

      return { updatedCase, completedTask, newInvestigationTask };
    });
  }
}
