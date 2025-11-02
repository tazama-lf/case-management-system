import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/auditLog.service';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly CLOSED_STATUSES = [
    CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
    CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  ];

  private readonly ACTIVE_TASK_STATUSES = [
    TaskStatus.STATUS_10_ASSIGNED, 
    TaskStatus.STATUS_20_IN_PROGRESS
  ];

  private readonly CONFIRMED_STATUSES = [
    CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED, 
    CaseStatus.STATUS_82_CLOSED_CONFIRMED
  ];

  private readonly REFUTED_STATUSES = [
    CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, 
    CaseStatus.STATUS_81_CLOSED_REFUTED
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getDateRange(dateRange: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let endDate = new Date(now);
    let startDate = new Date(now);

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        break;
      
      case 'last7':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      
      case 'last30':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      
      case 'last90':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of current month
        break;
      
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  async getCaseStatus(
    dateRange: string = 'last30', 
    filters?: { caseType?: string; priority?: string; investigator?: string }
  ) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const now = new Date();
    const trendStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const earliestDate = trendStartDate < startDate ? trendStartDate : startDate;
    
    const allCasesExtended = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: earliestDate,
        },
      },
      select: {
        case_id: true,
        status: true,
        case_type: true,
        created_at: true,
        updated_at: true,
      },
    });

    const allCases = allCasesExtended.filter(case_ => 
      case_.created_at >= startDate && case_.created_at <= endDate &&
      (!filters?.caseType || case_.case_type === filters.caseType) &&
      (!filters?.investigator || (case_ as any).case_owner_user_id === filters.investigator)
    );

    const typeCounts = allCases.reduce((acc, case_) => {
      const type = case_.case_type || 'NONE';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusCounts = allCases.reduce((acc, case_) => {
      acc[case_.status] = (acc[case_.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCases = allCases.length;


    const statusDistribution = this.processCasesByStatus(allCases);


    const closedCases = allCases.filter(case_ => this.CLOSED_STATUSES.includes(case_.status as any));
    const avgResolutionTime = this.calculateResolutionTime(closedCases);

    const caseTypes = Object.entries(typeCounts).map(([case_type, count]) => ({
      name: case_type,
      count: count,
    }));


    const outcomes = {
      resolved: 0,
      confirmed: 0,
      inconclusive: 0,
      pending: 0,
    };


    closedCases.forEach(case_ => {
      if (this.CONFIRMED_STATUSES.includes(case_.status as any)) {
        outcomes.confirmed++;
      } else if (this.REFUTED_STATUSES.includes(case_.status as any)) {
        outcomes.resolved++;
      } else if (case_.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
        outcomes.inconclusive++;
      }
    });

    const monthlyTrend: any[] = [];
    const trendCasesFromCache = allCasesExtended.filter(case_ => case_.created_at >= trendStartDate);
    let recentCases;
    if (trendCasesFromCache.length > 0 && trendStartDate >= startDate) {
      recentCases = trendCasesFromCache;
    } else {
      recentCases = allCasesExtended.filter(case_ => case_.created_at >= trendStartDate);
    }

    const casesByDate = new Map<string, { created: number; closed: number }>();

    recentCases.forEach((case_) => {
      const createdDate = case_.created_at.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      if (!casesByDate.has(createdDate)) {
        casesByDate.set(createdDate, { created: 0, closed: 0 });
      }

      const dateEntry = casesByDate.get(createdDate)!;
      dateEntry.created += 1;

      if (this.CLOSED_STATUSES.includes(case_.status as any)) {
        dateEntry.closed += 1;
      }
    });

    casesByDate.forEach((value, date) => {
      monthlyTrend.push({
        month: date,
        casesCreated: value.created,
        casesClosed: value.closed,
      });
    });

    const statusDetails: any[] = Object.entries(statusCounts).map(([status, count]) => {
      const percentage = totalCases > 0 ? ((count / totalCases) * 100).toFixed(1) : '0.0';
      const casesInStatus = allCases.filter(case_ => case_.status === status);
      
      let avgTimeInStatus = 'N/A';
      if (casesInStatus.length > 0) {
        const totalDays = casesInStatus.reduce((sum, case_) => {
          const timeInStatus = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + timeInStatus;
        }, 0);
        const avgDays = Math.round(totalDays / casesInStatus.length);
        avgTimeInStatus = avgDays === 0 ? '< 1 day' : `${avgDays} ${avgDays === 1 ? 'day' : 'days'}`;
      }

      return {
        status: this.formatStatusName(status as CaseStatus),
        count: count,
        percentage: `${percentage}%`,
        avgTimeInStatus,
        currentTrendPeriod: '+0%',
      };
    });

    const resolutionTrend: Array<{ month: string; avgResolutionTime: number; casesResolved: number }> = [];
    const trendMonths: Array<{ monthStart: Date; monthEnd: Date; label: string }> = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      trendMonths.push({ monthStart, monthEnd, label: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }) });
    }
 
    const allTrendCases = closedCases.filter(case_ => 
      case_.updated_at >= trendMonths[0].monthStart &&
      case_.updated_at <= trendMonths[trendMonths.length - 1].monthEnd
    );

    trendMonths.forEach(({ monthStart, monthEnd, label }) => {
      const monthClosedCases = allTrendCases.filter(case_ => 
        case_.updated_at >= monthStart && case_.updated_at <= monthEnd
      );

      const avgResolutionTimeMonth = monthClosedCases.length > 0
        ? monthClosedCases.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / monthClosedCases.length
        : 0;

      resolutionTrend.push({
        month: label,
        avgResolutionTime: Math.round(avgResolutionTimeMonth),
        casesResolved: monthClosedCases.length,
      });
    });

    return {
      stats: {
        totalCases,
        closedCases,
        openCases: totalCases - closedCases.length,
        avgResolutionTime: Math.round(avgResolutionTime),
      },
      statusDistribution,
      caseTypes,
      outcomes,
      monthlyTrend,
      resolutionTrend,
      statusDetails,
    };
  }

  async getInvestigatorWorkload(dateRange: string = 'last30') {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const now = new Date();
    const volumeTrendStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const earliestDate = volumeTrendStartDate < startDate ? volumeTrendStartDate : startDate;

    const allCasesExtended = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: earliestDate,
        },
        case_owner_user_id: { not: null },
      },
      select: {
        case_id: true,
        case_owner_user_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    const dateRangeCases = allCasesExtended.filter(case_ => 
      case_.created_at >= startDate && case_.created_at <= endDate
    );

    const investigatorsData = this.processInvestigatorData(dateRangeCases, []);

    const workloadData = investigatorsData.map(inv => ({
      investigatorId: inv.investigatorId,
      name: inv.name,
      activeCases: inv.activeCases,
      pendingTasks: inv.pendingTasks,
    }));

    const efficiencyData = investigatorsData.map(inv => {
      const closedCases = inv.allCases.filter(c => this.CLOSED_STATUSES.includes(c.status));
      const avgResolutionDays = this.calculateResolutionTime(closedCases);
      
      return {
        name: inv.name,
        avgDays: avgResolutionDays,
      };
    }).filter(data => data.avgDays > 0);


    const outcomeData = investigatorsData.map(inv => ({
      name: inv.name,
      confirmed: inv.confirmed,
      refuted: inv.refuted,
      inconclusive: inv.inconclusive,
    })).filter(data => data.confirmed > 0 || data.refuted > 0 || data.inconclusive > 0);


    const performanceData = investigatorsData.map(inv => {
      const totalCases = inv.allCases.length;
      const completionRate = totalCases > 0 ? Math.round((inv.closedCases / totalCases) * 100) : 0;
      const closedCases = inv.allCases.filter(c => this.CLOSED_STATUSES.includes(c.status));
      const avgResolutionTime = this.calculateResolutionTime(closedCases);

      return {
        investigatorId: inv.investigatorId,
        investigator: inv.name,
        role: 'Investigator',
        totalCases,
        activeCases: inv.activeCases,
        completedCases: inv.closedCases,
        pendingTasks: inv.pendingTasks,
        completionRate,
        avgResolutionTime,
        caseClosureRate: completionRate,
        performanceTrend: completionRate >= 80 ? 'Improving' : completionRate <= 50 ? 'Declining' : 'Stable',
      };
    });

    const volumeTrend: Array<{ month: string; investigators: { [key: string]: number } }> = [];
    const uniqueInvestigators = [...new Set(investigatorsData.map(inv => inv.investigatorId))];
    
    const volumeMonths: Array<{ monthStart: Date; monthEnd: Date; monthLabel: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });
      volumeMonths.push({ monthStart, monthEnd, monthLabel });
    }
    
    volumeMonths.forEach(({ monthStart, monthEnd, monthLabel }) => {
      const monthData = { month: monthLabel, investigators: {} };
      
      uniqueInvestigators.forEach(investigatorId => {
        const caseCount = allCasesExtended.filter(case_ => 
          case_.case_owner_user_id === investigatorId &&
          case_.created_at >= monthStart && 
          case_.created_at <= monthEnd
        ).length;
        
        monthData.investigators[`User ${investigatorId}`] = caseCount;
      });
      
      volumeTrend.push(monthData);
    });


    const totalInvestigators = investigatorsData.length;
    const avgCasesPerInvestigator = totalInvestigators > 0 
      ? Math.round(investigatorsData.reduce((sum, inv) => sum + inv.activeCases, 0) / totalInvestigators)
      : 0;

    const investigatorsWithClosedCases = performanceData.filter(p => p.avgResolutionTime > 0);
    const avgResolutionTime = investigatorsWithClosedCases.length > 0
      ? Math.round(investigatorsWithClosedCases.reduce((sum, p) => sum + p.avgResolutionTime, 0) / investigatorsWithClosedCases.length)
      : 0;

    const avgCaseClosureRate = performanceData.length > 0
      ? Math.round(performanceData.reduce((sum, p) => sum + p.caseClosureRate, 0) / performanceData.length)
      : 0;

    return {
      stats: {
        totalInvestigators,
        avgCasesPerInvestigator,
        avgResolutionTime,
        caseClosureRate: avgCaseClosureRate,
      },
      workloadData,
      volumeTrend,
      efficiencyData,
      outcomeData,
      performanceData,
    };
  }

  async getAuditLogs(dateRange: string = 'last30') {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const auditLogs = await this.auditLogService.getLogs(100, 0);

    const filteredLogs = auditLogs.filter(log => 
      log.performed_at >= startDate && log.performed_at <= endDate
    );

    const caseActions = filteredLogs.filter(log => 
      log.entity_name === 'Case' || (log.action_performed && log.action_performed.includes('Case'))
    ).length;

    const userSessions = filteredLogs.filter(log => 
      log.action_performed && (log.action_performed.includes('login') || log.action_performed.includes('session'))
    ).length;

    const systemWarnings = filteredLogs.filter(log => 
      log.outcome && (log.outcome.includes('WARNING') || log.outcome.includes('ERROR'))
    ).length;

    const formattedLogs = filteredLogs.map(log => {
      return {
        audit_log_id: log.audit_log_id ? log.audit_log_id.toString() : '',
        user_id: log.user_id ? log.user_id.toString() : '',
        operation: log.operation ? log.operation.toString() : '',
        entity_name: log.entity_name ? log.entity_name.toString() : '',
        action_performed: log.action_performed ? log.action_performed.toString() : '',
        outcome: log.outcome ? log.outcome.toString() : '',
        performed_at: log.performed_at ? log.performed_at.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }) : '',
        type: this.getAuditLogType(log.outcome || ''),
      };
    });

    return {
      stats: {
        totalLogs: filteredLogs.length,
        caseActions,
        userSessions,
        systemWarnings,
      },
      auditLogs: formattedLogs,
    };
  }

  async getCaseAgeing(dateRange: string = 'last30') {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const cases = await this.prisma.case.findMany({
      select: {
        case_id: true,
        status: true,
        case_type: true,
        created_at: true,
        updated_at: true,
        priority: true,
        case_owner_user_id: true,
      },
    });

    const now = new Date();
    const casesWithAge = cases.map(case_ => {
      const ageDays = Math.floor((now.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24));
      return { ...case_, ageDays };
    });

    const avgCaseAge = casesWithAge.length > 0
      ? casesWithAge.reduce((sum, case_) => sum + case_.ageDays, 0) / casesWithAge.length
      : 0;

    const closedStatuses = this.CLOSED_STATUSES;

    const closedCasesWithTimes = casesWithAge.filter(case_ => 
      closedStatuses.includes(case_.status as any)
    );

    const avgResolutionTime = closedCasesWithTimes.length > 0
      ? closedCasesWithTimes.reduce((sum, case_) => {
          const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + resolutionTime;
        }, 0) / closedCasesWithTimes.length
      : 0;

    const casesOver15Days = casesWithAge.filter(c => c.ageDays > 15).length;
    const casesOver30Days = casesWithAge.filter(c => c.ageDays >= 30).length;

    const ageingByStatus: any[] = [];
    const statusGroups = casesWithAge.reduce((acc, case_) => {
      if (!acc[case_.status]) acc[case_.status] = [];
      acc[case_.status].push(case_);
      return acc;
    }, {} as Record<string, typeof casesWithAge>);

    Object.entries(statusGroups).forEach(([status, cases]) => {
      ageingByStatus.push({
        status: this.formatStatusName(status as CaseStatus),
        age0to7: cases.filter(c => c.ageDays <= 7).length,
        age8to15: cases.filter(c => c.ageDays > 7 && c.ageDays <= 15).length,
        age16to30: cases.filter(c => c.ageDays > 15 && c.ageDays < 30).length,
        age30Plus: cases.filter(c => c.ageDays >= 30).length,
      });
    });

    const ageingDistribution = [
      { ageRange: '0-7 days', count: casesWithAge.filter(c => c.ageDays <= 7).length, percentage: 0 },
      { ageRange: '8-15 days', count: casesWithAge.filter(c => c.ageDays > 7 && c.ageDays <= 15).length, percentage: 0 },
      { ageRange: '16-30 days', count: casesWithAge.filter(c => c.ageDays > 15 && c.ageDays < 30).length, percentage: 0 },
      { ageRange: '30+ days', count: casesWithAge.filter(c => c.ageDays >= 30).length, percentage: 0 },
    ];

    const total = ageingDistribution.reduce((sum, item) => sum + item.count, 0);
    ageingDistribution.forEach(item => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });


    const allClosedCasesByType = closedCasesWithTimes;

    const caseTypeResolution = Object.values(CaseType).map((type) => {
      let typeCases;
      
      if (type === CaseType.NONE) {
        typeCases = allClosedCasesByType.filter(case_ => 
          case_.case_type === null || case_.case_type === CaseType.NONE
        );
      } else {
        typeCases = allClosedCasesByType.filter(case_ => case_.case_type === type);
      }

      if (typeCases.length === 0) {
        return null;
      }

      const avgResolutionTime = typeCases.reduce((sum, case_) => {
        const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
        return sum + resolutionTime;
      }, 0) / typeCases.length;

      return {
        caseType: type,
        avgDays: Math.round(avgResolutionTime),
      };
    }).filter(item => item !== null);

    const resolutionTrend: any[] = [];
    const currentDate = new Date();
    const trendStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
    
    const recentClosedCases = closedCasesWithTimes.filter(case_ => case_.updated_at >= trendStartDate);

    recentClosedCases.forEach((case_) => {
      const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
      resolutionTrend.push({
        month: case_.updated_at.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        avgDays: Math.round(resolutionTime),
      });
    });

    const caseDetails = casesWithAge.slice(0, 5).map(case_ => ({
      caseId: case_.case_id,
      type: case_.case_type || 'NONE',
      status: this.formatStatusName(case_.status),
      createdDate: case_.created_at.toLocaleDateString('en-US'),
      ageDays: case_.ageDays,
      priority: case_.priority,
      userId: case_.case_owner_user_id || null,
      investigator: case_.case_owner_user_id ? `User ${case_.case_owner_user_id}` : 'Unassigned',
    }));

    return {
      stats: {
        avgCaseAge: Math.round(avgCaseAge),
        avgResolutionTime: Math.round(avgResolutionTime),
        casesOver15Days,
        casesOver30Days,
      },
      ageingByStatus,
      resolutionTrend,
      ageingDistribution,
      caseTypeResolution,
      caseDetails,
    };
  }

  private buildCaseWhereClause(startDate: Date, endDate: Date, filters?: any): any {
    const whereClause: any = {
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filters?.caseType) {
      whereClause.case_type = filters.caseType;
    }
    if (filters?.priority) {
      whereClause.priority = filters.priority;
    }
    if (filters?.investigator) {
      whereClause.case_owner_user_id = filters.investigator;
    }

    return whereClause;
  }

  private processCasesByStatus(cases: any[]) {
    const statusDistribution = {
      assigned: 0,
      inProgress: 0,
      draft: 0,
      suspended: 0,
      pendingApproval: 0,
      closed: 0,
    };

    const statusMap: Record<CaseStatus, string> = {
      [CaseStatus.STATUS_10_ASSIGNED]: 'assigned',
      [CaseStatus.STATUS_20_IN_PROGRESS]: 'inProgress',
      [CaseStatus.STATUS_00_DRAFT]: 'draft',
      [CaseStatus.STATUS_21_SUSPENDED]: 'suspended',
      [CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT]: 'assigned',
      [CaseStatus.STATUS_03_RETURNED]: 'draft',
      [CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED]: 'refuted',
      [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED]: 'refuted',
      [CaseStatus.STATUS_81_CLOSED_REFUTED]: 'refuted',
      [CaseStatus.STATUS_82_CLOSED_CONFIRMED]: 'confirmed',
      [CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE]: 'inconclusive',
      [CaseStatus.STATUS_99_ABANDONED]: 'abandoned',
    };

    cases.forEach(case_ => {
      if (this.CLOSED_STATUSES.includes(case_.status as any)) {
        statusDistribution.closed++;
      } else if (statusMap[case_.status]) {
        const mappedStatus = statusMap[case_.status] as keyof typeof statusDistribution;
        statusDistribution[mappedStatus]++;
      }
    });

    return statusDistribution;
  }

  private calculateResolutionTime(cases: any[]): number {
    if (cases.length === 0) return 0;
    
    const totalResolutionTime = cases.reduce((sum, case_) => {
      const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
      return sum + resolutionTime;
    }, 0);
    
    return Math.round(totalResolutionTime / cases.length);
  }

  private processInvestigatorData(cases: any[], tasks: any[]) {
    const investigatorMap = new Map();


    cases.forEach(case_ => {
      if (!case_.case_owner_user_id) return;
      
      if (!investigatorMap.has(case_.case_owner_user_id)) {
        investigatorMap.set(case_.case_owner_user_id, {
          investigatorId: case_.case_owner_user_id,
          name: `User ${case_.case_owner_user_id}`,
          allCases: [],
          activeCases: 0,
          closedCases: 0,
          pendingTasks: 0,
          confirmed: 0,
          refuted: 0,
          inconclusive: 0,
        });
      }

      const investigator = investigatorMap.get(case_.case_owner_user_id);
      investigator.allCases.push(case_);

      if (this.CLOSED_STATUSES.includes(case_.status)) {
        investigator.closedCases++;
        
        if (this.CONFIRMED_STATUSES.includes(case_.status)) {
          investigator.confirmed++;
        } else if (this.REFUTED_STATUSES.includes(case_.status)) {
          investigator.refuted++;
        } else if (case_.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
          investigator.inconclusive++;
        }
      } else {
        investigator.activeCases++;
      }
    });


    tasks.forEach(task => {
      if (!task.assigned_user_id) return;
      
      if (investigatorMap.has(task.assigned_user_id)) {
        const investigator = investigatorMap.get(task.assigned_user_id);
        if (this.ACTIVE_TASK_STATUSES.includes(task.status)) {
          investigator.pendingTasks++;
        }
      }
    });

    return Array.from(investigatorMap.values());
  }

  private formatStatusName(status: CaseStatus): string {
    return status.replace('STATUS_', '').replace(/_/g, ' ');
  }

  private formatTaskStatusName(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.STATUS_30_COMPLETED: return 'Completed';
      case TaskStatus.STATUS_20_IN_PROGRESS: return 'In Progress';
      case TaskStatus.STATUS_01_UNASSIGNED: return 'Unassigned';
      case TaskStatus.STATUS_21_BLOCKED: return 'Blocked';
      case TaskStatus.STATUS_10_ASSIGNED: return 'Assigned';
      default: return 'Unknown';
    }
  }

  private getAuditLogType(outcome: string | null | undefined): 'Info' | 'Success' | 'Warning' | 'Error' {
    if (!outcome || typeof outcome !== 'string') return 'Info';
    
    if (outcome.includes('SUCCESS') || outcome.includes('COMPLETED')) return 'Success';
    if (outcome.includes('WARNING')) return 'Warning';
    if (outcome.includes('ERROR') || outcome.includes('FAILED')) return 'Error';
    return 'Info';
  }

  private optimizeQueryWithDateRange(baseQuery: any, startDate: Date, endDate: Date): any {
    return {
      ...baseQuery,
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };
  }

  private createDateBoundaries(dateRange: string): { start: Date; end: Date } {

    const now = new Date();
    const boundaries = {
      start: new Date(now),
      end: new Date(now)
    };


    switch (dateRange) {
      case 'today':
        boundaries.start.setHours(0, 0, 0, 0);
        boundaries.end.setHours(23, 59, 59, 999);
        break;
      case 'last7':
        boundaries.start.setDate(now.getDate() - 7);
        boundaries.start.setHours(0, 0, 0, 0);
        break;
      case 'last30':
        boundaries.start.setDate(now.getDate() - 30);
        boundaries.start.setHours(0, 0, 0, 0);
        break;
      default:
        boundaries.start.setDate(now.getDate() - 30);
        boundaries.start.setHours(0, 0, 0, 0);
    }

    return boundaries;
  }

  private getOptimizationHints(): string[] {
    return [
      'Consider adding index on (created_at, status) for faster report queries',
      'Consider adding index on (case_owner_user_id, created_at) for investigator queries',
      'Consider adding index on (updated_at, status) for resolution time calculations',
      'Consider database connection pooling for concurrent report requests',
      'Consider implementing Redis caching for frequently accessed reports'
    ];
  }

  async getFilters() {

    const allCases = await this.prisma.case.findMany({
      select: { 
        case_type: true,
        priority: true,
        case_owner_user_id: true
      },
      distinct: ['case_type', 'priority', 'case_owner_user_id'],
    });


    const caseTypes = [...new Set(allCases.map(c => c.case_type))];
    const priorities = [...new Set(allCases.map(c => c.priority))];
    const investigators = [...new Set(allCases.filter(c => c.case_owner_user_id).map(c => c.case_owner_user_id))];

    return {
      caseTypes: caseTypes.map(ct => ({
        value: ct || 'NONE',
        label: ct || 'None'
      })),
      priorities: priorities.map(p => ({
        value: p || 'NONE',
        label: p || 'None'
      })),
      investigators: investigators.map(i => ({
        value: i || '',
        label: i ? `User ${i.slice(0, 8)}` : 'Unassigned'
      }))
    };
  }
}
