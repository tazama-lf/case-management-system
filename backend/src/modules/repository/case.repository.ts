import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseStatus, TaskStatus, Prisma, Case, Alert, Task } from '@prisma/client';

@Injectable()
export class CaseRepository {
    constructor(
        private readonly prismaService: PrismaService,
    ) { }

    async findAlert(alertId: number) {
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

    async findCaseWithApprovalTask(caseId: number) {
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

    async findCaseBasicInfo(caseId: number) {
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
    async findTaskByNameAndStatus(caseId: number, taskName: string, status: TaskStatus) {
        return await this.prismaService.task.findFirst({
            where: {
                case_id: caseId,
                name: taskName,
                status: status,
            },
        });
    }

    async findTaskByNames(caseId: number, names: string[], status: TaskStatus) {
        return await this.prismaService.task.findFirst({
            where: {
                case_id: caseId,
                name: { in: names },
                status: status,
            },
        });
    }

    // Reopening task queries - all return task with comments
    async findReopeningTaskWithComments(caseId: number) {
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

    async findUnassignedTaskForReopening(caseId: number) {
        return this.findReopeningTaskWithComments(caseId);
    }

    async findReopeningTaskForRejection(caseId: number) {
        return this.findReopeningTaskWithComments(caseId);
    }

    async findCaseWithPermissionCheck(caseId: number, userId: string) {
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

    async createComment(data: { user_id: string; task_id?: number; case_id?: number; note: string }) {
        return await this.prismaService.comment.create({ data });
    }

    async findCaseForReopening(caseId: number) {
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

    async findCaseForClosureApproval(caseId: number) {
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

    async findCaseForReview(caseId: number) {
        return await this.prismaService.case.findUnique({
            where: { case_id: caseId },
            include: {
             tasks: {
                orderBy: {
                created_at: 'desc',
            },
        },
        },
    });
    }

    async findCaseById(caseId: number): Promise<{ alert: Alert | null; tasks: Task[] } & Case> {
        const caseData = await this.prismaService.case.findUnique({
            where: { case_id: caseId },
            include: { alert: true, tasks: true },
        });

        if (!caseData) {
            throw new NotFoundException('Case Not Found');
        }

        return caseData;
    }

    async updateCase(caseId: number, data: Prisma.CaseUpdateInput) {
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

    async findCaseWithCompletedInvestigation(caseId: number) {
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
        investigationTaskId: number,
        userId: string,
        comment?: { note: string; taskId?: number },
    ) {
        return await this.prismaService.$transaction(async (tx) => {
            const updatedCase = await tx.case.update({
                where: { case_id: caseId },
                data: { status, updated_at: new Date() },
            });

            await tx.task.update({
                where: { task_id: investigationTaskId },
                data: { status: TaskStatus.STATUS_30_COMPLETED, updated_at: new Date() },
            });

            if (comment) {
                await tx.comment.create({
                    data: {
                        user_id: userId,
                        case_id: caseId,
                        task_id: comment.taskId,
                        note: comment.note,
                    },
                });
            }

            return { updatedCase };
        });
    }

    async approveClosureTask(
        caseId: number,
        taskId: number,
        status: CaseStatus,
        supervisorId: string,
        comments?: string,
    ) {
        return await this.prismaService.$transaction(async (tx) => {
            const updatedCase = await tx.case.update({
                where: { case_id: caseId },
                data: { status, updated_at: new Date() },
            });

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
    ) {
        return await this.prismaService.$transaction(async (tx) => {
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

            // await tx.comment.create({
            //     data: {
            //         user_id: supervisorId,
            //         task_id: approvalTask.task_id,
            //         case_id: caseId,
            //         note: `Case closure rejected by supervisor: ${comments}`,
            //     },
            // });

            // Create new investigation task assigned to the user who requested approval
            const newInvestigationTask = await tx.task.create({
                data: {
                    case_id: caseId,
                    name: taskNames.INVESTIGATE_CASE,
                    description: 'Continue investigation based on supervisor feedback. Previous closure was rejected.',
                    status: TaskStatus.STATUS_10_ASSIGNED,
                    assigned_user_id: originalInvestigatorId,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            });

            // Add supervisor feedback as comment on new investigation task
            await tx.comment.create({
                data: {
                    user_id: supervisorId,
                    case_id: caseId,
                    task_id: newInvestigationTask.task_id,
                    note: `Supervisor Feedback:\n${comments}\n\nAction Required: Address the concerns raised and resubmit for closure approval.`,
                },
            });

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
