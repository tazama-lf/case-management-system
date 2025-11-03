import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/auditLog.service';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly CLOSED_CASE_STATUSES = [
    CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
    CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  ];

  private readonly ACTIVE_TASK_STATUSES = [
    TaskStatus.STATUS_10_ASSIGNED,
    TaskStatus.STATUS_20_IN_PROGRESS,
  ];

  private readonly STATUS_MAP: Record<CaseStatus, string> = {
    [CaseStatus.STATUS_10_ASSIGNED]: 'assigned',
    [CaseStatus.STATUS_20_IN_PROGRESS]: 'inProgress',
    [CaseStatus.STATUS_00_DRAFT]: 'draft',
    [CaseStatus.STATUS_21_SUSPENDED]: 'suspended',
    [CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT]: 'assigned',
    [CaseStatus.STATUS_03_RETURNED]: 'returned',
    [CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED]: 'confirmed',
    [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED]: 'refuted',
    [CaseStatus.STATUS_81_CLOSED_REFUTED]: 'refuted',
    [CaseStatus.STATUS_82_CLOSED_CONFIRMED]: 'confirmed',
    [CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE]: 'inconclusive',
    [CaseStatus.STATUS_99_ABANDONED]: 'abandoned',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private processCaseDataForInvestigator(
    allCases: any[],
    allTasks: any[],
    investigatorId: string
  ) {
    const investigatorCases = allCases.filter(c => c.case_owner_user_id === investigatorId);
    const investigatorTasks = allTasks.filter(t => t.assigned_user_id === investigatorId);
    
    const activeCases = investigatorCases.filter(c => 
      !this.CLOSED_CASE_STATUSES.includes(c.status)
    ).length;
    
    const closedCases = investigatorCases.filter(c => 
      this.CLOSED_CASE_STATUSES.includes(c.status)
    );
    
    const pendingTasks = investigatorTasks.filter(t => 
      this.ACTIVE_TASK_STATUSES.includes(t.status)
    ).length;
    
    const avgResolutionTime = closedCases.length > 0
      ? closedCases.reduce((sum, case_) => {
          const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + resolutionTime;
        }, 0) / closedCases.length
      : 0;
    
    const totalCases = investigatorCases.length;
    const completionRate = totalCases > 0 ? Math.round((closedCases.length / totalCases) * 100) : 0;
    
    return {
      totalCases,
      activeCases,
      closedCases: closedCases.length,
      pendingTasks,
      avgResolutionTime: Math.round(avgResolutionTime),
      completionRate,
      cases: investigatorCases,
    };
  }

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
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
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
    dateRange?: string, 
    filters?: { caseType?: string; priority?: string; investigator?: string }
  ) {
    const { startDate, endDate } = this.getDateRange(dateRange || 'last30');
    const now = new Date();
    const trendStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const allCases = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: trendStartDate,
        },
      },
      select: {
        case_id: true,
        status: true,
        case_type: true,
        priority: true,
        case_owner_user_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    const filteredCases = allCases.filter(case_ => {
      const inDateRange = case_.created_at >= startDate && case_.created_at <= endDate;
      const matchesType = !filters?.caseType || case_.case_type === filters.caseType;
      const matchesPriority = !filters?.priority || case_.priority === filters.priority;
      const matchesInvestigator = !filters?.investigator || case_.case_owner_user_id === filters.investigator;
      return inDateRange && matchesType && matchesPriority && matchesInvestigator;
    });

    const totalCases = filteredCases.length;
    const closedCases = filteredCases.filter(c => this.CLOSED_CASE_STATUSES.includes(c.status as any)).length;
    
    const closedCasesWithTimes = filteredCases.filter(c => this.CLOSED_CASE_STATUSES.includes(c.status as any));
    const avgResolutionTime = closedCasesWithTimes.length > 0
      ? closedCasesWithTimes.reduce((sum, case_) => {
          const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + resolutionTime;
        }, 0) / closedCasesWithTimes.length
      : 0;



    const statusCounts = new Map<CaseStatus, number>();
    filteredCases.forEach(case_ => {
      const currentCount = statusCounts.get(case_.status) || 0;
      statusCounts.set(case_.status, currentCount + 1);
    });

    const statusDistribution = {
      assigned: 0,
      inProgress: 0,
      draft: 0,
      suspended: 0,
      pendingApproval: 0,
      closed: 0,
    };

    statusCounts.forEach((count, status) => {
      if (this.CLOSED_CASE_STATUSES.includes(status as any)) {
        statusDistribution.closed += count;
      } else if (this.STATUS_MAP[status]) {
        const mappedStatus = this.STATUS_MAP[status] as keyof typeof statusDistribution;
        statusDistribution[mappedStatus] += count;
      }
    });


    const typeCounts = new Map<string, number>();
    filteredCases.forEach(case_ => {
      const type = case_.case_type || 'NONE';
      const currentCount = typeCounts.get(type) || 0;
      typeCounts.set(type, currentCount + 1);
    });

    const caseTypes = Array.from(typeCounts.entries()).map(([type, count]) => ({
      name: type,
      count,
    }));

    
    const outcomes = {
      resolved: 0,
      confirmed: 0,
      inconclusive: 0,
      pending: 0,
    };

    filteredCases.forEach(case_ => {
      if (case_.status === CaseStatus.STATUS_82_CLOSED_CONFIRMED || case_.status === CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED) {
        outcomes.confirmed += 1;
      } else if (case_.status === CaseStatus.STATUS_81_CLOSED_REFUTED || case_.status === CaseStatus.STATUS_72_AUTOCLOSED_REFUTED) {
        outcomes.resolved += 1;
      } else if (case_.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
        outcomes.inconclusive += 1;
      }
    });

    
    const monthlyTrend: any[] = [];
    const casesByDate = new Map<string, { created: number; closed: number }>();

    allCases.forEach((case_) => {
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

      if (this.CLOSED_CASE_STATUSES.includes(case_.status as any)) {
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

    
    const statusDetails: any[] = [];
    statusCounts.forEach((count, status) => {
      const percentage = totalCases > 0 ? ((count / totalCases) * 100).toFixed(1) : '0.0';
      
      const casesInStatus = filteredCases.filter(c => c.status === status);
      let avgTimeInStatus = 'N/A';
      if (casesInStatus.length > 0) {
        const totalDays = casesInStatus.reduce((sum, case_) => {
          const timeInStatus = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + timeInStatus;
        }, 0);
        const avgDays = Math.round(totalDays / casesInStatus.length);
        avgTimeInStatus = avgDays === 0 ? '< 1 day' : `${avgDays} ${avgDays === 1 ? 'day' : 'days'}`;
      }

      statusDetails.push({
        status: this.formatStatusName(status),
        count: count,
        percentage: `${percentage}%`,
        avgTimeInStatus,
        currentTrendPeriod: '+0%', 
      });
    });

   
    const resolutionTrend: Array<{ month: string; avgResolutionTime: number; casesResolved: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const monthClosedCases = allCases.filter(c => 
        c.updated_at >= monthStart && 
        c.updated_at <= monthEnd &&
        this.CLOSED_CASE_STATUSES.includes(c.status as any)
      );

      const avgResolutionTimeMonth = monthClosedCases.length > 0
        ? monthClosedCases.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / monthClosedCases.length
        : 0;

      resolutionTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        avgResolutionTime: Math.round(avgResolutionTimeMonth),
        casesResolved: monthClosedCases.length,
      });
    }

    return {
      stats: {
        totalCases,
        closedCases,
        openCases: totalCases - closedCases,
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

  async getInvestigatorWorkload(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange || 'last30');

    
    const allCases = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
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

 
    const investigatorIds = [...new Set(allCases.map(c => c.case_owner_user_id).filter(Boolean))] as string[];
    const allTasks = await this.prisma.task.findMany({
      where: {
        assigned_user_id: { in: investigatorIds },
      },
      select: {
        assigned_user_id: true,
        status: true,
      },
    });

    const workloadData = investigatorIds.map(investigatorId => {
      if (!investigatorId) {
        return {
          investigatorId: '',
          name: 'Unassigned',
          activeCases: 0,
          pendingTasks: 0,
        };
      }

      const data = this.processCaseDataForInvestigator(allCases, allTasks, investigatorId);
      
      return {
        investigatorId,
        name: `User ${investigatorId}`,
        activeCases: data.activeCases,
        pendingTasks: data.pendingTasks,
      };
    });

    const efficiencyData = investigatorIds.map(investigatorId => {
      if (!investigatorId) {
        return {
          name: 'Unassigned',
          avgDays: 0,
        };
      }
      
      const data = this.processCaseDataForInvestigator(allCases, allTasks, investigatorId);
      
      return {
        name: `User ${investigatorId}`,
        avgDays: data.avgResolutionTime,
      };
    });

    const outcomeData = investigatorIds.map(investigatorId => {
      if (!investigatorId) {
        return {
          name: 'Unassigned',
          confirmed: 0,
          refuted: 0,
          inconclusive: 0,
        };
      }
      
      const investigatorCases = allCases.filter(c => c.case_owner_user_id === investigatorId);
      
      const confirmed = investigatorCases.filter(c => 
        [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED, CaseStatus.STATUS_82_CLOSED_CONFIRMED].includes(c.status as any)
      ).length;
      
      const refuted = investigatorCases.filter(c => 
        [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, CaseStatus.STATUS_81_CLOSED_REFUTED].includes(c.status as any)
      ).length;
      
      const inconclusive = investigatorCases.filter(c => 
        c.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE
      ).length;

      return {
        name: `User ${investigatorId}`,
        confirmed,
        refuted,
        inconclusive,
      };
    });

    const performanceData = investigatorIds.map(investigatorId => {
      if (!investigatorId) {
        return {
          investigatorId: '',
          investigator: 'Unassigned',
          role: 'Investigator',
          totalCases: 0,
          activeCases: 0,
          completedCases: 0,
          pendingTasks: 0,
          completionRate: 0,
          avgResolutionTime: 0,
          caseClosureRate: 0,
          performanceTrend: 'Unknown' as const,
        };
      }
      
      const data = this.processCaseDataForInvestigator(allCases, allTasks, investigatorId);
      
      return {
        investigatorId,
        investigator: `User ${investigatorId}`,
        role: 'Investigator',
        totalCases: data.totalCases,
        activeCases: data.activeCases,
        completedCases: data.closedCases,
        pendingTasks: data.pendingTasks,
        completionRate: data.completionRate,
        avgResolutionTime: data.avgResolutionTime,
        caseClosureRate: data.completionRate,
        performanceTrend: data.completionRate >= 80 ? 'Improving' : data.completionRate <= 50 ? 'Declining' : 'Stable',
      };
    });

    const volumeTrend: Array<{ month: string; investigators: { [key: string]: number } }> = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      const monthData = { month: monthLabel, investigators: {} };
      
      for (const investigatorId of investigatorIds) {
        if (!investigatorId) continue;
        
        const monthCases = allCases.filter(c => 
          c.case_owner_user_id === investigatorId &&
          c.created_at >= monthStart &&
          c.created_at <= monthEnd
        );
        
        monthData.investigators[`User ${investigatorId}`] = monthCases.length;
      }
      
      volumeTrend.push(monthData);
    }

    const totalInvestigators = workloadData.length;
    const avgCasesPerInvestigator = totalInvestigators > 0 
      ? workloadData.reduce((sum, w) => sum + (w?.activeCases || 0), 0) / totalInvestigators 
      : 0;

    const validPerformanceData = performanceData;
    const totalResolutionTime = validPerformanceData.reduce((sum, w) => sum + (w?.avgResolutionTime || 0), 0);
    const investigatorsWithClosedCases = validPerformanceData.filter(w => (w?.avgResolutionTime || 0) > 0).length;
    const avgResolutionTime = investigatorsWithClosedCases > 0
      ? totalResolutionTime / investigatorsWithClosedCases
      : 0;

    const totalClosureRate = validPerformanceData.reduce((sum, w) => sum + (w?.caseClosureRate || 0), 0);
    const avgCaseClosureRate = validPerformanceData.length > 0
      ? totalClosureRate / validPerformanceData.length
      : 0;

    return {
      stats: {
        totalInvestigators,
        avgCasesPerInvestigator: Math.round(avgCasesPerInvestigator),
        avgResolutionTime: Math.round(avgResolutionTime),
        caseClosureRate: Math.round(avgCaseClosureRate),
      },
      workloadData: workloadData,
      volumeTrend: volumeTrend,
      efficiencyData: efficiencyData,
      outcomeData: outcomeData,
      performanceData: performanceData,
    };
  }

  async getAuditLogs(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange || 'last30');

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

  async getCaseAgeing(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange || 'last30');
    const currentDate = new Date();
    const trendStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);

    const allCases = await this.prisma.case.findMany({
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
    const casesWithAge = allCases.map(case_ => {
      const ageDays = Math.floor((now.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24));
      return { ...case_, ageDays };
    });

    const avgCaseAge = casesWithAge.length > 0
      ? casesWithAge.reduce((sum, case_) => sum + case_.ageDays, 0) / casesWithAge.length
      : 0;

    const closedCasesWithTimes = casesWithAge.filter(case_ => 
      this.CLOSED_CASE_STATUSES.includes(case_.status as any)
    );

    const avgResolutionTime = closedCasesWithTimes.length > 0
      ? closedCasesWithTimes.reduce((sum, case_) => {
          const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + resolutionTime;
        }, 0) / closedCasesWithTimes.length
      : 0;

    const casesOver15Days = casesWithAge.filter(c => c.ageDays > 15).length;
    const casesOver30Days = casesWithAge.filter(c => c.ageDays >= 30).length;

    const ageingByStatusMap = new Map<CaseStatus, { age0to7: number; age8to15: number; age16to30: number; age30Plus: number }>();
    
    casesWithAge.forEach(case_ => {
      if (!ageingByStatusMap.has(case_.status)) {
        ageingByStatusMap.set(case_.status, { age0to7: 0, age8to15: 0, age16to30: 0, age30Plus: 0 });
      }
      
      const counts = ageingByStatusMap.get(case_.status)!;
      if (case_.ageDays <= 7) counts.age0to7++;
      else if (case_.ageDays <= 15) counts.age8to15++;
      else if (case_.ageDays < 30) counts.age16to30++;
      else counts.age30Plus++;
    });

    const ageingByStatus = Array.from(ageingByStatusMap.entries()).map(([status, counts]) => ({
      status: this.formatStatusName(status),
      ...counts,
    }));

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

    const caseTypeResolutionMap = new Map<CaseType, { totalResolutionTime: number; count: number }>();
    
    closedCasesWithTimes.forEach(case_ => {
      const type = case_.case_type || CaseType.NONE;
      if (!caseTypeResolutionMap.has(type)) {
        caseTypeResolutionMap.set(type, { totalResolutionTime: 0, count: 0 });
      }
      
      const data = caseTypeResolutionMap.get(type)!;
      const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
      data.totalResolutionTime += resolutionTime;
      data.count++;
    });

    const caseTypeResolution = Array.from(caseTypeResolutionMap.entries()).map(([type, data]) => ({
      caseType: type,
      avgDays: Math.round(data.totalResolutionTime / data.count),
    }));

    const recentClosedCases = allCases.filter(case_ => 
      case_.updated_at >= trendStartDate && 
      this.CLOSED_CASE_STATUSES.includes(case_.status as any)
    );

    const resolutionTrend = recentClosedCases.map(case_ => {
      const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
      return {
        month: case_.updated_at.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        avgDays: Math.round(resolutionTime),
      };
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

  async getFilters() {

    const allCases = await this.prisma.case.findMany({
      select: { 
        case_type: true,
        priority: true,
        case_owner_user_id: true,
      },
    });

    const uniqueCaseTypes = new Set<string>();
    const uniquePriorities = new Set<string>();
    const uniqueInvestigators = new Set<string>();

    allCases.forEach(case_ => {
      uniqueCaseTypes.add(case_.case_type || 'NONE');
      uniquePriorities.add(case_.priority || 'NONE');
      if (case_.case_owner_user_id) {
        uniqueInvestigators.add(case_.case_owner_user_id);
      }
    });

    return {
      caseTypes: Array.from(uniqueCaseTypes).map(ct => ({
        value: ct,
        label: ct === 'NONE' ? 'None' : ct
      })),
      priorities: Array.from(uniquePriorities).map(p => ({
        value: p,
        label: p === 'NONE' ? 'None' : p
      })),
      investigators: Array.from(uniqueInvestigators).map(i => ({
        value: i,
        label: `User ${i.slice(0, 8)}`
      }))
    };
  }
}
