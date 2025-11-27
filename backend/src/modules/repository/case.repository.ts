import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseStatus, TaskStatus, Prisma, Case, Alert, Task } from '@prisma/client';

@Injectable()
export class CaseRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findAlert(alertId: string) {
    return await this.prismaService.alert.findUnique({
      where: { alert_id: alertId },
    });
  }

  async updateAlertByAlertId(dto, priorityScore, createdCase, priority) {
    return await this.prismaService.alert.update({
      where: { alert_id: dto.alertId },
      data: {
        priority,
        alert_type: dto.alertType,
        priority_score: priorityScore,
        case_id: createdCase.case_id,
      },
    });
  }

  async findCaseWithApprovalTask(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
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

  async findCaseBasicInfo(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
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
  async findTaskByNameAndStatus(caseId: string, taskName: string, status: TaskStatus) {
    return await this.prismaService.task.findFirst({
      where: {
        case_id: caseId,
        name: taskName,
        status: status,
      },
    });
  }

  async findTaskByNames(caseId: string, names: string[], status: TaskStatus) {
    return await this.prismaService.task.findFirst({
      where: {
        case_id: caseId,
        name: { in: names },
        status: status,
      },
    });
  }

  // Reopening task queries - all return task with comments
  async findReopeningTaskWithComments(caseId: string) {
    return await this.prismaService.task.findFirst({
      where: {
        case_id: caseId,
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

  async findUnassignedTaskForReopening(caseId: string) {
    return this.findReopeningTaskWithComments(caseId);
  }

  async findReopeningTaskForRejection(caseId: string) {
    return this.findReopeningTaskWithComments(caseId);
  }

  async findCaseWithPermissionCheck(caseId: string, userId: string) {
    return await this.prismaService.case.findFirst({
      where: {
        case_id: caseId,
        OR: [
          { case_owner_user_id: userId },
          { tasks: { some: { assigned_user_id: userId, name: { in: ['Investigate Case', 'Investigate case', 'investigate case'] } } } },
        ],
      },
      include: {
        tasks: true,
        alert: true,
        comments: true,
      },
    });
  }

  async createComment(data: { user_id: string; task_id?: string; case_id?: string; note: string }) {
    return await this.prismaService.comment.create({ data });
  }

  async findCaseForReopening(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Reopening',
          },
        },
      },
    });
  }

  async findCaseForClosureApproval(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
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

  async findCaseForReview(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: { tasks: true },
    });
  }

  async findCaseById(caseId: string): Promise<{ alert: Alert | null; tasks: Task[] } & Case> {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: { alert: true, tasks: true },
    });

    if (!caseData) {
      throw new NotFoundException('Case Not Found');
    }

    return caseData;
  }

  async updateCase(caseId: string, data: Prisma.CaseUpdateInput) {
    return await this.prismaService.case.update({
      where: { case_id: caseId },
      data,
    });
  }

  async executeTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return await this.prismaService.$transaction(fn);
  }

  getTransactionClient() {
    return this.prismaService;
  }

  async findUnassignedAndInProgressTasksByUser(userId: string) {
    return this.prismaService.task.findMany({
      where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
      select: { task_id: true, name: true, case_id: true, created_at: true },
      orderBy: { created_at: 'asc' },
      take: 5,
    });
  }

  async findOldestUnassignedCase() {
    return this.prismaService.case.findFirst({
      where: { case_owner_user_id: null },
      orderBy: { created_at: 'asc' },
      select: { case_id: true, created_at: true },
    });
  }

  async countCasesWithFilters(whereClause: Prisma.CaseWhereInput): Promise<number> {
    return await this.prismaService.case.count({ where: whereClause });
  }

  async findCasesWithFilters(
    whereClause: Prisma.CaseWhereInput,
    options: { skip: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ) {
    return await this.prismaService.case.findMany({
      where: whereClause,
      include: {
        tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true } },
        alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true, transaction: true } },
      },
      skip: options.skip,
      take: options.limit,
      orderBy: { [options.sortBy]: options.sortOrder },
    });
  }

  async CountWithOrConditions(whereConditions: Prisma.CaseWhereInput[]) {
    return await this.prismaService.case.count({ where: { OR: whereConditions } });
  }

  async findCasesWithOrConditions(
    whereConditions: Prisma.CaseWhereInput[],
    options: { skip: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ) {
    return await this.prismaService.case.findMany({
      where: { OR: whereConditions },
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
  async countCases(whereClause: Prisma.CaseWhereInput) {
    return await this.prismaService.case.count({ where: whereClause });
  }

  // Specialized count methods for common queries
  async countOwnedCases(userId: string) {
    return this.countCases({ case_owner_user_id: userId });
  }

  async countCasesWithTaskAssignments(userId: string) {
    return this.countCases({ tasks: { some: { assigned_user_id: userId } } });
  }

  async countUnassignedCases() {
    return this.countCases({ case_owner_user_id: null });
  }

  // Generic groupBy method
  async groupCasesBy(field: 'status' | 'priority' | 'case_type', whereClause?: Prisma.CaseWhereInput | Prisma.CaseWhereInput[]) {
    const where = Array.isArray(whereClause) ? { OR: whereClause } : whereClause;
    return await this.prismaService.case.groupBy({
      by: [field],
      where,
      _count: { case_id: true },
    });
  }

  // Convenience methods using generic groupBy
  async groupCasesByStatus(whereConditions: Prisma.CaseWhereInput[]) {
    return this.groupCasesBy('status', whereConditions);
  }

  async groupCasesByPriority(whereConditions: Prisma.CaseWhereInput[]) {
    return this.groupCasesBy('priority', whereConditions);
  }

  async groupCasesByType(whereClause: Prisma.CaseWhereInput) {
    return this.groupCasesBy('case_type', whereClause);
  }

  async findCaseWithCompletedInvestigation(caseId: string) {
    return await this.prismaService.case.findUnique({
      where: { case_id: caseId },
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

  async countActiveCases(userId: string) {
    return await this.prismaService.case.count({
      where: {
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

  async countPendingTasks(userId: string) {
    return await this.prismaService.task.count({
      where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
    });
  }

  async findAllUserActiveCases(userId: string) {
    return await this.prismaService.case.findMany({
      where: {
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

  async createCase(caseDetail: any, tx?: Prisma.TransactionClient) {
    const prisma = tx || this.prismaService;
    return await prisma.case.create({
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
  }

  async createDraftCase(caseDetail: any, dto: any, priorityScore: number, priority: any) {
    return await this.prismaService.$transaction(async (prisma) => {
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

      this.logger.log(`[DraftCase] Draft case ${createdCase.case_id} created in PostgreSQL only (no BPMN)`, CaseRepository.name);

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

      this.logger.log(`[DraftCase] Alert ${dto.alertId} linked to case ${createdCase.case_id}`, CaseRepository.name);

      return { case: createdCase, alert: updatedAlert };
    });
  }
}
