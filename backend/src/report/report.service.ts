import { Injectable } from '@nestjs/common';
import { TaskService } from '../task/task.service';
import { CaseService } from '../case/case.service';
import { UserService } from '../shared/user.service';
import { exportToCSV, exportToExcel, exportToPDF } from '../shared/utils/report-export.util';

@Injectable()
export class ReportService {
  constructor(
    private readonly taskService: TaskService,
    private readonly caseService: CaseService,
    private readonly userService: UserService,
  ) {}

  async getInvestigatorWorkloadReport(filters: any, tenantId: string) {
    const where: any = {
      case: { tenant_id: tenantId },
    };
    if (filters.from && filters.to) {
      where.created_at = { gte: new Date(filters.from), lte: new Date(filters.to) };
    }
    if (filters.caseType) {
      where.case = { ...where.case, case_type: filters.caseType };
    }
    if (filters.priority) {
      where.case = { ...where.case, priority: filters.priority };
    }
    if (filters.investigatorId) {
      where["assigned_user_id"] = filters.investigatorId;
    }
    const tasks = await (this.taskService as any).prisma.task.findMany({
      where,
      include: { case: true },
    });

    const investigatorIds = Array.from(
      new Set(tasks.map((task: any) => task.assigned_user_id).filter((id: any) => typeof id === 'string' && id))
    );
    const investigatorDetails: Record<string, any> = {};
    for (const userId of investigatorIds) {
      try {
        investigatorDetails[userId as string] = await this.userService.getUserDetails(userId as string);
      } catch {
        investigatorDetails[userId as string] = { username: 'Unknown', firstName: '', lastName: '', roles: [] };
      }
    }
    const investigatorMap: Record<string, any> = {};
    for (const task of tasks) {
      const invId = task.assigned_user_id;
      if (!invId) continue;
      const user = investigatorDetails[invId] || {};
      if (!investigatorMap[invId]) {
        investigatorMap[invId] = {
          investigatorId: invId,
          name: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || 'Unknown',
          role: user.roles ? user.roles.join(', ') : 'Unknown',
          activeCases: 0,
          completedCases: 0,
          totalCases: 0,
          resolutionTimes: [],
          caseClosureCount: 0,
          monthlyCaseCounts: {},
          outcomeCounts: { CONFIRMED: 0, REFUTED: 0, INCONCLUSIVE: 0 },
        };
      }
      investigatorMap[invId].totalCases += 1;
      if (task.status === 'COMPLETED') {
        investigatorMap[invId].completedCases += 1;
        if (task.completed_at && task.created_at) {
          const resolutionTime = (new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24);
          investigatorMap[invId].resolutionTimes.push(resolutionTime);
        }
        investigatorMap[invId].caseClosureCount += 1;
      } else {
        investigatorMap[invId].activeCases += 1;
      }
      const created = task.created_at ? new Date(task.created_at) : null;
      if (created) {
        const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        if (!investigatorMap[invId].monthlyCaseCounts[monthKey]) {
          investigatorMap[invId].monthlyCaseCounts[monthKey] = 0;
        }
        investigatorMap[invId].monthlyCaseCounts[monthKey] += 1;
      }
      const caseStatus = (task.case && task.case.status) || task.case_status;
      if (caseStatus === 'STATUS_82_CLOSED_CONFIRMED') {
        investigatorMap[invId].outcomeCounts.CONFIRMED += 1;
      } else if (caseStatus === 'STATUS_81_CLOSED_REFUTED') {
        investigatorMap[invId].outcomeCounts.REFUTED += 1;
      } else if (caseStatus === 'STATUS_83_CLOSED_INCONCLUSIVE') {
        investigatorMap[invId].outcomeCounts.INCONCLUSIVE += 1;
      }
    }

    const investigators = Object.values(investigatorMap);
    const totalInvestigators = investigators.length;
    const avgCasesPerInvestigator = totalInvestigators ? (tasks.length / totalInvestigators) : 0;
    const allResolutionTimes = investigators.flatMap(inv => inv.resolutionTimes);
    const avgResolutionTime = allResolutionTimes.length
      ? (allResolutionTimes.reduce((a, b) => a + b, 0) / allResolutionTimes.length)
      : 0;
    const totalClosedCases = investigators.reduce((sum, inv) => sum + inv.caseClosureCount, 0);
    const caseClosureRate = tasks.length ? (totalClosedCases / tasks.length) * 100 : 0;
    const details = investigators.map(inv => ({
      investigator: inv.name,
      role: inv.role,
      activeCases: inv.activeCases,
      completedCases: inv.completedCases,
      avgResolutionTime: inv.resolutionTimes.length
        ? (inv.resolutionTimes.reduce((a, b) => a + b, 0) / inv.resolutionTimes.length).toFixed(1)
        : 'N/A',
      caseClosureRate: inv.totalCases
        ? ((inv.caseClosureCount / inv.totalCases) * 100).toFixed(1) + '%'
        : '0%',
    }));
    const allMonths = Array.from(new Set(
      investigators.flatMap(inv => Object.keys(inv.monthlyCaseCounts))
    )).sort();
    const caseVolumeTrend = investigators.map(inv => ({
      name: inv.name,
      data: allMonths.map(month => inv.monthlyCaseCounts[month] || 0),
    }));
    const caseOutcomeDistribution = investigators.map(inv => ({
      name: inv.name,
      confirmed: inv.outcomeCounts.CONFIRMED,
      refuted: inv.outcomeCounts.REFUTED,
      inconclusive: inv.outcomeCounts.INCONCLUSIVE,
    }));
    const trends = {
      caseVolumeTrend: { months: allMonths, data: caseVolumeTrend },
      caseOutcomeDistribution,
    };
    const workloadByInvestigator = investigators.map(inv => ({
      name: inv.name,
      activeCases: inv.activeCases,
      pendingTasks: inv.totalCases - inv.completedCases,
    }));
    return {
      metrics: {
        totalInvestigators,
        avgCasesPerInvestigator: Number(avgCasesPerInvestigator.toFixed(1)),
        avgResolutionTime: Number(avgResolutionTime.toFixed(1)),
        caseClosureRate: Number(caseClosureRate.toFixed(1)),
      },
      workloadByInvestigator,
      trends,
      details,
    };
  }

  async exportReport(data: any, format: 'csv' | 'excel' | 'pdf'): Promise<string | Buffer> {
    if (!data.details || !data.details.length) return '';
    const headers = Object.keys(data.details[0]);
    if (format === 'csv') {
      return exportToCSV(data.details, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(data.details, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(data.details, headers);
    }
    return '';
  }
}