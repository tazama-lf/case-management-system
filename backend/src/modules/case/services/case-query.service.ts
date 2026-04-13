import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { GetUserCasesQueryDto } from '../dto/get-user-cases.dto';
import { GetAllCasesQueryDto } from '../dto/get-all-cases.dto';
import { Case, CaseStatus, CaseType, Priority, TaskStatus } from '@prisma/client-cms';
import { TaskValidationUtil } from '../../shared/utils/task-validation.util';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { Outcome } from '../../../utils/types/outcome';
import { UpdateCaseDto } from '../dto';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { JsonValue } from '@prisma/client-cms/runtime/library';

@Injectable()
export class CaseQueryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly taskValidationUtil: TaskValidationUtil,
  ) {}

  async getUserCases(
    userId: string,
    query: GetUserCasesQueryDto,
    isComplianceOfficer?: boolean,
  ): Promise<{
    cases: Array<{
      case_id: number;
      status: CaseStatus;
      priority: Priority;
      parent_id: number | null;
      case_type: CaseType | null;
      created_at: Date;
      updated_at: Date;
      user_role: 'owner' | 'task_assignee' | 'both';
      user_tasks: Array<{
        task_id: number;
        name: string | null;
        status: TaskStatus;
        created_at: Date | undefined;
      }>;
      total_tasks: number;
      alert:
        | {
            alert_id: number;
            message: string;
            confidence_per: number;
            transaction: JsonValue;
          }
        | undefined;
      latest_comment_date: Date;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      totalOwnedCases: number;
      totalTaskAssignments: number;
      casesByStatus: Record<string, number>;
      casesByPriority: Record<string, number>;
    };
  }> {
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
        const userTasks = this.taskValidationUtil.getUserAssignedTasks(caseItem.tasks, userId);
        const hasTaskAssignment = userTasks.length > 0;
        const userRole: 'owner' | 'task_assignee' | 'both' = isOwner && hasTaskAssignment ? 'both' : isOwner ? 'owner' : 'task_assignee';

        return {
          case_id: caseItem.case_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          parent_id: caseItem.parent_id,
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

      // const statusCounts = casesByStatus.reduce<Record<string, number>>((acc, item) => {
      //   acc[item.status] = item._count.case_id;
      //   return acc;
      // }, {});

      const statusCounts = casesByStatus.reduce<Record<string, number>>((acc, item) => {
        const result = acc;
        result[item.status] = item._count.case_id;
        return result;
      }, {});

      // const priorityCounts = casesByPriority.reduce<Record<string, number>>((acc, item) => {
      //   acc[item.priority] = item._count.case_id;
      //   return acc;
      // }, {});

      const priorityCounts = casesByPriority.reduce<Record<string, number>>((acc, item) => {
        const result = acc;
        result[item.priority] = item._count.case_id;
        return result;
      }, {});

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get user cases: ${errorMessage}`, errorStack, CaseQueryService.name);
      throw error;
    }
  }

  async getAllCases(
    query: GetAllCasesQueryDto,
    tenantId: string,
    investigatorUserId?: string,
    isComplianceOfficer?: boolean,
  ): Promise<{
    cases: Array<{
      case_id: number;
      tenant_id: string;
      case_creator_user_id: string;
      case_owner_user_id: string | null;
      status: CaseStatus;
      priority: Priority;
      case_type: CaseType | null;
      created_at: Date;
      updated_at: Date;
      total_tasks: number;
      tasks: Array<{
        name: string | null;
        status: TaskStatus;
        created_at: Date;
        task_id: number;
        assigned_user_id: string | null;
      }>;
      completed_tasks: number;
      pending_tasks: number;
      alert: {
        alert_id: number;
        alert_type: CaseType | null;
        message: string;
        transaction: JsonValue;
        confidence_per: number;
      } | null;
      parent_id: number | null;
      assigned_to:
        | {
            user_id: string | null;
            task_count: number;
          }
        | undefined;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    statistics: {
      totalCases: number;
      casesByStatus: Record<string, number>;
      casesByPriority: Record<string, number>;
      casesByType: Record<string, number>;
      unassignedCases: number;
      averageTasksPerCase: number;
      oldestUnassignedCase:
        | {
            case_id: number;
            created_at: Date;
            days_old: number;
          }
        | undefined;
    };
  }> {
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
        sarStrStatus,
        search,
        excludeDraft = false,
        excludeClosed = false,
        closedOnly = false,
      } = query;
      const whereClause: any = {};
      const baseFilters: any = {};

      // Handle status filtering with new exclusion/inclusion options
      if (closedOnly) {
        // Show only closed cases
        baseFilters.status = {
          in: [
            'STATUS_81_CLOSED_REFUTED',
            'STATUS_82_CLOSED_CONFIRMED',
            'STATUS_83_CLOSED_INCONCLUSIVE',
            'STATUS_71_AUTOCLOSED_CONFIRMED',
            'STATUS_72_AUTOCLOSED_REFUTED',
          ],
        };
      } else if (status) {
        // Single status filter takes precedence
        baseFilters.status = status;
      } else {
        // Handle exclusions
        const excludedStatuses: string[] = [];
        if (excludeDraft) {
          excludedStatuses.push('STATUS_00_DRAFT');
        }
        if (excludeClosed) {
          excludedStatuses.push(
            'STATUS_81_CLOSED_REFUTED',
            'STATUS_82_CLOSED_CONFIRMED',
            'STATUS_83_CLOSED_INCONCLUSIVE',
            'STATUS_71_AUTOCLOSED_CONFIRMED',
            'STATUS_72_AUTOCLOSED_REFUTED',
          );
        }
        if (excludedStatuses.length > 0) {
          baseFilters.status = {
            notIn: excludedStatuses,
          };
        }
      }

      if (priority) baseFilters.priority = priority;
      if (caseType) baseFilters.case_type = caseType;
      if (tenantId) baseFilters.tenant_id = tenantId;
      if (createdAfter ?? createdBefore) {
        baseFilters.created_at = {};
        if (createdAfter) baseFilters.created_at.gte = new Date(createdAfter);
        if (createdBefore) baseFilters.created_at.lte = new Date(createdBefore);
      }

      // Build search filter condition
      let searchFilterCondition: any = null;
      if (search && search.trim() !== '') {
        const searchTerm = search.trim();
        const searchUpper = searchTerm.toUpperCase();
        const normalizedSearch = searchTerm.toLowerCase().replace(/[\/\s\-_]/gv, ''); // Remove slashes, spaces, dashes, underscores
        const orConditions: any[] = [];

        // SPECIAL CASE: Handle "N/A" search separately (only search for null values)
        if (normalizedSearch === 'na' || normalizedSearch === 'none' || normalizedSearch === 'null') {
          // Search for cases with null fields or missing data that would display as "N/A" in the UI
          orConditions.push({
            alert: {
              alert_type: null,
            },
          });
          orConditions.push({
            case_type: null,
          });
          orConditions.push({
            NOT: {
              tasks: {
                some: {
                  name: { in: ['SAR_STR_FILING', 'SAR/STR Filing', 'File SAR/STR Report'] },
                },
              },
            },
          });

          searchFilterCondition = { OR: orConditions };
          this.logger.log(
            `N/A search filter created for null/missing fields: ${JSON.stringify(searchFilterCondition)}`,
            CaseQueryService.name,
          );
        } else {
          // Normal search (not N/A)

          // 1. SEARCH by case_id (exact numeric match only)
          const numericSearch = parseInt(searchTerm, 10);
          if (!isNaN(numericSearch)) {
            orConditions.push({ case_id: numericSearch });
          }

          // 2. PARTIAL SEARCH by case_type (e.g., "fr" matches "FRAUD", "fraud_and" matches "FRAUD_AND_AML")
          const caseTypeEnums = ['FRAUD', 'AML', 'FRAUD_AND_AML'];
          const matchingCaseTypes = caseTypeEnums.filter((type) => type.includes(searchUpper));
          if (matchingCaseTypes.length > 0) {
            orConditions.push({
              case_type: { in: matchingCaseTypes },
            });
          }

          // 3. PARTIAL SEARCH by case status (e.g., "pending" matches all STATUS_*_PENDING_* statuses)
          const statusEnums = [
            'STATUS_00_DRAFT',
            'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
            'STATUS_02_READY_FOR_ASSIGNMENT',
            'STATUS_03_RETURNED',
            'STATUS_10_ASSIGNED',
            'STATUS_20_IN_PROGRESS',
            'STATUS_21_SUSPENDED',
            'STATUS_22_PENDING_FINAL_APPROVAL',
            'STATUS_31_PENDING_CASE_REOPENING_APPROVAL',
            'STATUS_71_AUTOCLOSED_CONFIRMED',
            'STATUS_72_AUTOCLOSED_REFUTED',
            'STATUS_81_CLOSED_REFUTED',
            'STATUS_82_CLOSED_CONFIRMED',
            'STATUS_83_CLOSED_INCONCLUSIVE',
            'STATUS_99_ABANDONED',
          ];
          const matchingStatuses = statusEnums.filter((status) => status.includes(searchUpper));
          if (matchingStatuses.length > 0) {
            orConditions.push({
              status: { in: matchingStatuses },
            });
          }

          // 4. Search by alert message (string field) - skip for pure numbers
          if (isNaN(numericSearch)) {
            orConditions.push({
              alert: {
                message: { contains: searchTerm, mode: 'insensitive' },
              },
            });
          }

          // 5. SEARCH by confidence score (alert.confidence_per)
          if (!isNaN(numericSearch)) {
            orConditions.push({
              alert: {
                confidence_per: numericSearch,
              },
            });
          }

          // 6. PARTIAL SEARCH in SAR/STR task status (only for compliance officers)
          if (isComplianceOfficer) {
            const taskStatusEnums = [
              'STATUS_01_UNASSIGNED',
              'STATUS_10_ASSIGNED',
              'STATUS_20_IN_PROGRESS',
              'STATUS_21_BLOCKED',
              'STATUS_30_COMPLETED',
            ];
            const matchingTaskStatuses = taskStatusEnums.filter((status) => status.includes(searchUpper));
            if (matchingTaskStatuses.length > 0) {
              orConditions.push({
                tasks: {
                  some: {
                    name: { in: ['SAR_STR_FILING', 'SAR/STR Filing', 'File SAR/STR Report'] },
                    status: { in: matchingTaskStatuses },
                  },
                },
              });
            }
          }

          // Only add search filter if we have conditions
          if (orConditions.length > 0) {
            searchFilterCondition = { OR: orConditions };
            this.logger.log(`Search filter condition created for term: "${searchTerm}"`, CaseQueryService.name);
            this.logger.log(`Search filter: ${JSON.stringify(searchFilterCondition)}`, CaseQueryService.name);
          } else {
            this.logger.log(`No matching search conditions for term: "${searchTerm}"`, CaseQueryService.name);
          }
        }
      }

      // Build SAR/STR status filter condition separately
      let sarStrFilterCondition: any = null;
      if (sarStrStatus && sarStrStatus !== 'N/A') {
        // Filter cases that have a SAR/STR task with the specified status
        sarStrFilterCondition = {
          tasks: {
            some: {
              name: { in: ['SAR_STR_FILING', 'SAR/STR Filing', 'File SAR/STR Report'] },
              status: sarStrStatus,
            },
          },
        };
      } else if (sarStrStatus === 'N/A') {
        // Filter cases that don't have any SAR/STR task
        sarStrFilterCondition = {
          NOT: {
            tasks: {
              some: {
                name: { in: ['SAR_STR_FILING', 'SAR/STR Filing', 'File SAR/STR Report'] },
              },
            },
          },
        };
      }

      // Handle compliance officer filtering - only show STATUS_82_CLOSED_CONFIRMED cases
      if (isComplianceOfficer) {
        baseFilters.status = 'STATUS_82_CLOSED_CONFIRMED';
        const andConditions: any[] = [baseFilters];

        // Add SAR/STR filter as separate condition if provided
        if (sarStrFilterCondition) {
          andConditions.push(sarStrFilterCondition);
        }

        // Add search filter as separate condition if provided
        if (searchFilterCondition) {
          andConditions.push(searchFilterCondition);
        }

        whereClause.AND = andConditions;
      } else if (investigatorUserId) {
        const andConditions: any[] = [baseFilters];

        // Add SAR/STR filter as separate condition if provided
        if (sarStrFilterCondition) {
          andConditions.push(sarStrFilterCondition);
        }

        // For investigators with search: apply search filter within their accessible cases
        if (searchFilterCondition) {
          // Combine search with investigator visibility rules
          andConditions.push({
            AND: [
              searchFilterCondition, // Must match search
              {
                OR: [
                  { case_owner_user_id: investigatorUserId },
                  {
                    tasks: {
                      some: {
                        assigned_user_id: investigatorUserId,
                      },
                    },
                  },
                  { case_owner_user_id: null },
                  { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT },
                ],
              },
            ],
          });
        } else {
          // No search - just apply standard investigator filters
          andConditions.push({
            OR: [
              { case_owner_user_id: investigatorUserId },
              {
                tasks: {
                  some: {
                    assigned_user_id: investigatorUserId,
                  },
                },
              },
              { case_owner_user_id: null },
              { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT },
            ],
          });
        }

        whereClause.AND = andConditions;
      } else {
        // Build AND conditions for general users
        const andConditions: any[] = [baseFilters];

        // Add SAR/STR filter as separate condition if provided
        if (sarStrFilterCondition) {
          andConditions.push(sarStrFilterCondition);
        }

        // Add search filter as separate condition if provided
        if (searchFilterCondition) {
          andConditions.push(searchFilterCondition);
        }

        // Apply additional filters to baseFilters if needed
        if (ownerId) baseFilters.case_owner_user_id = ownerId;
        if (unassignedOnly) baseFilters.case_owner_user_id = null;

        // Only use AND if we have multiple conditions, otherwise use baseFilters directly
        if (andConditions.length > 1) {
          whereClause.AND = andConditions;
        } else {
          Object.assign(whereClause, baseFilters);
        }
      }

      this.logger.log(`Where clause: ${JSON.stringify(whereClause)}`, CaseQueryService.name);

      const skip = (page - 1) * limit;
      const totalCount = await this.prismaService.case.count({ where: whereClause });
      const cases = await this.prismaService.case.findMany({
        where: whereClause,
        include: {
          tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true, created_at: true } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true, transaction: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        this.logger.log(
          `CaseDetails:${JSON.stringify(caseItem)} Case${caseItem.case_id} parentId: ${caseItem.parent_id} `,
          CaseQueryService.name,
        );
        const taskCounts = this.taskValidationUtil.getTaskStatusCounts(caseItem.tasks);
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
          parent_id: caseItem.parent_id,
          assigned_to:
            assignedUsers.length > 0
              ? { user_id: caseItem.case_owner_user_id ?? assignedUsers[0], task_count: assignedUsers.length }
              : undefined,
        };
      });
      const [statusStats, priorityStats, typeStats, unassignedCount] = await Promise.all([
        this.prismaService.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['case_type'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.count({ where: { case_owner_user_id: null } }),
      ]);
      const casesByStatus = statusStats.reduce<Record<string, number>>((acc, item) => {
        const result = acc;
        result[item.status] = item._count.case_id;
        return result;
      }, {});
      const casesByPriority = priorityStats.reduce<Record<string, number>>((acc, item) => {
        const result = acc;
        result[item.priority] = item._count.case_id;
        return result;
      }, {});
      const casesByType = typeStats.reduce<Record<string, number>>((acc, item) => {
        const result = acc;
        if (item.case_type) result[item.case_type] = item._count.case_id;
        return result;
      }, {});
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get all cases: ${errorMessage}`, errorStack, CaseQueryService.name);
      throw error;
    }
  }

  async getUserWorkloadStats(
    userId: string,
    isComplianceOfficer?: boolean,
  ): Promise<{
    totalActiveCases: number;
    totalPendingTasks: number;
    casesByStatus: Record<string, number>;
    casesByPriority: Record<string, number>;
    oldestCase: {
      case_id: number;
      created_at: Date;
      days_old: number;
    } | null;
    averageCaseAge: number;
    upcomingTasks: Array<{
      task_id: number;
      name: string | null;
      case_id: number;
      days_old: number;
    }>;
  }> {
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
        this.prismaService.task.count({
          where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        }),
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
        allUserCases.forEach((c) => {
          totalAge += (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24);
        });
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get workload stats: ${errorMessage}`, errorStack, CaseQueryService.name);
      throw error;
    }
  }

  async retrieveCase(caseId: number, tenantId: string, isComplianceOfficer?: boolean): Promise<Case | null> {
    const retrievedCase = await this.caseRepository.findCaseById(caseId, tenantId);
    return retrievedCase;
  }

  async getSubCasesDetails(caseId: number): Promise<Case[]> {
    const subCases = await this.prismaService.case.findMany({
      where: {
        parent_id: caseId,
      },
    });
    return subCases;
  }

  async updateCase(caseId: number, updateData: Partial<UpdateCaseDto>, userId: string): Promise<Case> {
    try {
      const updatedCase = await this.caseRepository.updateCase(caseId, {
        case_type: updateData.caseType,
        priority: updateData.priority,
        status: updateData.status,
        case_owner_user_id: updateData.caseOwnerUserId,
      });

      this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'updateCase',
          entityName: CaseQueryService.name,
          actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        updatedCase.tenant_id,
      );

      return updatedCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error updating case: ${errorMessage}`, errorStack, CaseQueryService.name);
      throw error;
    }
  }
}
