import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { GetUserCasesQueryDto } from '../dto/get-user-cases.dto';
import { GetAllCasesQueryDto } from '../dto/get-all-cases.dto';
import { CaseStatus, TaskStatus } from '@prisma/client-cms';
import { TaskValidationUtil } from '../../shared/utils/task-validation.util';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { AuditLogService } from '../../audit/auditLog.service';
import { Outcome } from '../../../utils/types/outcome';
import { UpdateCaseDto } from '../dto';
import { EventLogService } from 'src/modules/event_log/eventLog.service';

@Injectable()
export class CaseQueryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly auditLogService: AuditLogService,
    private readonly eventLogService: EventLogService,
  ) { }

  async getUserCases(userId: string, query: GetUserCasesQueryDto, isComplianceOfficer?: boolean) {
    try {
      const {
        status,
        priority,
        includeTaskAssignments,
        includeOwnedCases,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const skip = (page - 1) * limit;
      const whereConditions: any[] = [];

      if (includeOwnedCases) {
        const ownedCasesCondition: any = { case_owner_user_id: userId };
        if (status) ownedCasesCondition.status = status;
        if (priority) ownedCasesCondition.priority = priority;
        // Compliance officers only see STATUS_82_CLOSED_CONFIRMED cases
        if (isComplianceOfficer) ownedCasesCondition.status = 'STATUS_82_CLOSED_CONFIRMED';
        whereConditions.push(ownedCasesCondition);
      }

      if (includeTaskAssignments) {
        const taskAssignmentCondition: any = { tasks: { some: { assigned_user_id: userId } } };
        if (status) taskAssignmentCondition.status = status;
        if (priority) taskAssignmentCondition.priority = priority;
        // Compliance officers only see STATUS_82_CLOSED_CONFIRMED cases
        if (isComplianceOfficer) taskAssignmentCondition.status = 'STATUS_82_CLOSED_CONFIRMED';
        whereConditions.push(taskAssignmentCondition);
      }

      if (whereConditions.length === 0) {
        return {
          cases: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
          summary: { totalOwnedCases: 0, totalTaskAssignments: 0, casesByStatus: {}, casesByPriority: {} },
        };
      }

      const totalCount = await this.prismaService.case.count({ where: { OR: whereConditions } });
      const cases = await this.prismaService.case.findMany({
        where: { OR: whereConditions },
        include: {
          tasks: { orderBy: { created_at: 'desc' } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, priority: true, alert_type: true, transaction: true } },
          comments: { select: { comment_id: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 1 },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        const isOwner = caseItem.case_owner_user_id === userId;
        const userTasks = TaskValidationUtil.getUserAssignedTasks(caseItem.tasks, userId);
        const hasTaskAssignment = userTasks.length > 0;
        const userRole: 'owner' | 'task_assignee' | 'both' = isOwner && hasTaskAssignment ? 'both' : isOwner ? 'owner' : 'task_assignee';

        return {
          case_id: caseItem.case_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          user_role: userRole,
          user_tasks: userTasks.map((task) => ({
            task_id: task.task_id,
            name: task.name,
            status: task.status,
            created_at: task.created_at,
          })),
          total_tasks: caseItem.tasks.length,
          alert: caseItem.alert
            ? {
              alert_id: caseItem.alert.alert_id,
              message: caseItem.alert.message,
              confidence_per: caseItem.alert.confidence_per,
              transaction: caseItem.alert.transaction,
            }
            : undefined,
          latest_comment_date: caseItem.comments[0]?.created_at,
        };
      });

      const [ownedCasesCount, taskAssignmentCasesCount, casesByStatus, casesByPriority] = await Promise.all([
        this.prismaService.case.count({ where: { case_owner_user_id: userId } }),
        this.prismaService.case.count({ where: { tasks: { some: { assigned_user_id: userId } } } }),
        this.prismaService.case.groupBy({ by: ['status'], where: { OR: whereConditions }, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: { OR: whereConditions }, _count: { case_id: true } }),
      ]);

      const statusCounts = casesByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

      const priorityCounts = casesByPriority.reduce((acc, item) => {
        acc[item.priority] = item._count.case_id;
        return acc;
      }, {} as Record<string, number>);

      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        summary: {
          totalOwnedCases: ownedCasesCount,
          totalTaskAssignments: taskAssignmentCasesCount,
          casesByStatus: statusCounts,
          casesByPriority: priorityCounts,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user cases: ${error.message}`, error.stack, CaseQueryService.name);
      throw error;
    }
  }

  async getAllCases(query: GetAllCasesQueryDto, tenantId: string, investigatorUserId?: string, isComplianceOfficer?: boolean) {
    try {
      const {
        status,
        priority,
        caseType,
        ownerId,
        unassignedOnly,
        createdAfter,
        createdBefore,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const whereClause: any = {};
      const baseFilters: any = {};
      if (status) baseFilters.status = status;
      if (priority) baseFilters.priority = priority;
      if (caseType) baseFilters.case_type = caseType;
      if (tenantId) baseFilters.tenant_id = tenantId;
      if (createdAfter || createdBefore) {
        baseFilters.created_at = {};
        if (createdAfter) baseFilters.created_at.gte = new Date(createdAfter);
        if (createdBefore) baseFilters.created_at.lte = new Date(createdBefore);
      }
      // Handle compliance officer filtering - only show STATUS_82_CLOSED_CONFIRMED cases
      if (isComplianceOfficer) {
        baseFilters.status = 'STATUS_82_CLOSED_CONFIRMED';
        Object.assign(whereClause, baseFilters);
      }
      else if (investigatorUserId) {
        // For investigators, show cases that are either:
        // 1. Unassigned (case_owner_user_id is null)
        // 2. Ready for assignment (available in work queue)
        // 3. Owned by this specific investigator
        whereClause.AND = [
          baseFilters,
          {
            OR: [
              { case_owner_user_id: null },
              { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT },
              { case_owner_user_id: investigatorUserId },
            ],
          },
        ];
      } else {
        Object.assign(whereClause, baseFilters);
        if (ownerId) whereClause.case_owner_user_id = ownerId;
        if (unassignedOnly) whereClause.case_owner_user_id = null;
      }
      const skip = (page - 1) * limit;
      const totalCount = await this.prismaService.case.count({ where: whereClause });
      const cases = await this.prismaService.case.findMany({
        where: whereClause,
        include: {
          tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true, transaction: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });
      const processedCases = cases.map((caseItem) => {
        const taskCounts = TaskValidationUtil.getTaskStatusCounts(caseItem.tasks);
        const assignedUsers = [...new Set(caseItem.tasks.map((t) => t.assigned_user_id).filter(Boolean))];
        return {
          case_id: caseItem.case_id,
          tenant_id: caseItem.tenant_id,
          case_creator_user_id: caseItem.case_creator_user_id,
          case_owner_user_id: caseItem.case_owner_user_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          total_tasks: caseItem.tasks.length,
          tasks: caseItem.tasks,
          completed_tasks: taskCounts.completed,
          pending_tasks: taskCounts.pending,
          alert: caseItem.alert,
          assigned_to:
            assignedUsers.length > 0
              ? { user_id: caseItem.case_owner_user_id || assignedUsers[0], task_count: assignedUsers.length }
              : undefined,
        };
      });
      const [statusStats, priorityStats, typeStats, unassignedCount] = await Promise.all([
        this.prismaService.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['case_type'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.count({ where: { case_owner_user_id: null } }),
      ]);
      const casesByStatus = statusStats.reduce((acc, item) => { acc[item.status] = item._count.case_id; return acc; }, {} as Record<string, number>);
      const casesByPriority = priorityStats.reduce((acc, item) => { acc[item.priority] = item._count.case_id; return acc; }, {} as Record<string, number>);
      const casesByType = typeStats.reduce((acc, item) => { if (item.case_type) acc[item.case_type] = item._count.case_id; return acc; }, {} as Record<string, number>);
      const totalTasks = cases.reduce((sum, c) => sum + c.tasks.length, 0);
      const averageTasksPerCase = cases.length > 0 ? Math.round((totalTasks / cases.length) * 10) / 10 : 0;
      let oldestUnassignedCase: { case_id: number; created_at: Date; days_old: number } | undefined;
      if (unassignedCount > 0) {
        const oldestUnassigned = await this.prismaService.case.findFirst({
          where: { case_owner_user_id: null },
          orderBy: { created_at: 'asc' },
          select: { case_id: true, created_at: true },
        });
        if (oldestUnassigned) {
          const daysOld = Math.floor((new Date().getTime() - oldestUnassigned.created_at.getTime()) / (1000 * 60 * 60 * 24));
          oldestUnassignedCase = { case_id: oldestUnassigned.case_id, created_at: oldestUnassigned.created_at, days_old: daysOld };
        }
      }
      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        statistics: {
          totalCases: totalCount,
          casesByStatus,
          casesByPriority,
          casesByType,
          unassignedCases: unassignedCount,
          averageTasksPerCase,
          oldestUnassignedCase,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all cases: ${error.message}`, error.stack, CaseQueryService.name);
      throw error;
    }
  }

  async getUserWorkloadStats(userId: string, isComplianceOfficer?: boolean) {
    try {
      // For compliance officers, filter to only STATUS_82_CLOSED_CONFIRMED cases
      const statusFilter = isComplianceOfficer
        ? { status: CaseStatus.STATUS_82_CLOSED_CONFIRMED }
        : {
          status: {
            notIn: [
              CaseStatus.STATUS_81_CLOSED_REFUTED,
              CaseStatus.STATUS_82_CLOSED_CONFIRMED,
              CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
              CaseStatus.STATUS_99_ABANDONED,
            ],
          },
        };
      const [activeCases, pendingTasks, allUserCases] = await Promise.all([
        this.prismaService.case.count({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            ...statusFilter,
          },
        }),
        this.prismaService.task.count({ where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } } }),
        this.prismaService.case.findMany({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            ...statusFilter,
          },
          select: { case_id: true, status: true, priority: true, created_at: true },
          orderBy: { created_at: 'asc' },
        }),
      ]);
      const now = new Date();
      let oldestCase: { case_id: number; created_at: Date; days_old: number } | null = null;
      let totalAge = 0;
      if (allUserCases.length > 0) {
        const oldest = allUserCases[0];
        const daysOld = Math.floor((now.getTime() - oldest.created_at.getTime()) / (1000 * 60 * 60 * 24));
        oldestCase = { case_id: oldest.case_id, created_at: oldest.created_at, days_old: daysOld };
        allUserCases.forEach((c) => { totalAge += (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24); });
      }
      const casesByStatus: Record<string, number> = {};
      const casesByPriority: Record<string, number> = {};
      allUserCases.forEach((c) => {
        casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
        casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
      });
      const averageCaseAge = allUserCases.length > 0 ? Math.round((totalAge / allUserCases.length) * 10) / 10 : 0;
      const upcomingDeadlines = await this.prismaService.task.findMany({
        where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        select: { task_id: true, name: true, case_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: 5,
      });
      return {
        totalActiveCases: activeCases,
        totalPendingTasks: pendingTasks,
        casesByStatus,
        casesByPriority,
        oldestCase,
        averageCaseAge,
        upcomingTasks: upcomingDeadlines.map((task) => ({
          task_id: task.task_id,
          name: task.name,
          case_id: task.case_id,
          days_old: Math.floor((now.getTime() - task.created_at.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get workload stats: ${error.message}`, error.stack, CaseQueryService.name);
      throw error;
    }
  }

  async retrieveCase(caseId: number, isComplianceOfficer?: boolean) {
    const retrievedCase = await this.caseRepository.findCaseById(caseId);
    if (!retrievedCase) throw new NotFoundException(`Case not found: ${caseId}`);

    // Compliance officers can only access STATUS_82_CLOSED_CONFIRMED cases
    if (isComplianceOfficer && retrievedCase.status !== 'STATUS_82_CLOSED_CONFIRMED') {
      throw new ForbiddenException('Compliance officers can only access confirmed closed cases');
    }

    return retrievedCase;
  }

  async updateCase(caseId: number, updateData: Partial<UpdateCaseDto>, userId: string) {
    try {
      const updatedCase = await this.caseRepository.updateCase(caseId, {
        case_type: updateData.caseType,
        priority: updateData.priority,
        status: updateData.status,
        case_owner_user_id: updateData.caseOwnerUserId,
      });

      this.auditLogService.logAction({
        userId,
        operation: 'updateCase',
        entityName: CaseQueryService.name,
        actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });

      this.eventLogService.logEventAction({
        userId,
        operation: 'updateCase',
        entityName: CaseQueryService.name,
        actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(`Error updating case: ${error.message}`, error.stack, CaseQueryService.name);
      throw error;
    }
  }

  async getCaseActionHistory(caseId: number, tenantId: string, userId: string) {
    const caseHistory = await this.prismaService.case.findFirst({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
    });

    if (!caseHistory) {
      throw new NotFoundException(`Case with ID ${caseId} was not found for tenant ${tenantId}.`);
    }

    const history = await this.auditLogService.getActionHistoryForCase(caseId);
    return {
      caseId,
      tenantId,
      userId,
      history,
    };
  }
}
