import type { ReportsData, CaseOutcome } from '../types/reports.types';

export class ReportsProcessor {
  private static readonly DEFAULT_COLORS = new Map([
    ['REFUTED', '#10b981'],
    ['CONFIRMED', '#ef4444'], 
    ['INCONCLUSIVE', '#f59e0b'],
    ['ASSIGNED', '#3b82f6'],
    ['IN_PROGRESS', '#10b981'],
    ['DRAFT', '#f59e0b'],
    ['SUSPENDED', '#ef4444'],
    ['PENDING_APPROVAL', '#8b5cf6'],
    ['CLOSED', '#6b7280']
  ]);

  private static readonly STATUS_DISPLAY_NAMES = new Map([
    ['assigned', 'ASSIGNED'],
    ['inProgress', 'IN PROGRESS'],
    ['draft', 'DRAFT'],
    ['suspended', 'SUSPENDED'],
    ['pendingApproval', 'PENDING APPROVAL'],
    ['closed', 'CLOSED']
  ]);

  static processOutcomeData(outcomes: CaseOutcome): Array<{
    label: string;
    value: number;
    color: string;
    percentage: number;
  }> {
    const outcomeEntries = new Map([
      ['REFUTED', outcomes.refuted || 0],
      ['CONFIRMED', outcomes.confirmed || 0],
      ['INCONCLUSIVE', outcomes.inconclusive || 0]
    ]);

    const total = Array.from(outcomeEntries.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(outcomeEntries.entries()).map(([label, value]) => ({
      label,
      value,
      color: this.DEFAULT_COLORS.get(label) || '#6b7280',
      percentage: total > 0 ? (value / total) * 100 : 0
    }));
  }

  static processStatusDistributionData(statusDistribution: any, totalCases: number): Array<{
    label: string;
    value: number;
    color: string;
    percentage: number;
  }> {
    const statusEntries = new Map([
      ['assigned', statusDistribution.assigned || 0],
      ['inProgress', statusDistribution.inProgress || 0],
      ['draft', statusDistribution.draft || 0],
      ['suspended', statusDistribution.suspended || 0],
      ['pendingApproval', statusDistribution.pendingApproval || 0],
      ['closed', statusDistribution.closed || 0]
    ]);

    return Array.from(statusEntries.entries()).map(([key, value]) => ({
      label: this.STATUS_DISPLAY_NAMES.get(key) || key.toUpperCase(),
      value,
      color: this.DEFAULT_COLORS.get(this.STATUS_DISPLAY_NAMES.get(key) || key.toUpperCase()) || '#6b7280',
      percentage: totalCases > 0 ? (value / totalCases) * 100 : 0
    }));
  }

  static createFallbackData(): ReportsData {
    return {
      stats: { totalCases: 0, closedCases: 0, openCases: 0, avgResolutionTime: 0 },
      statusDistribution: { assigned: 0, inProgress: 0, draft: 0, suspended: 0, pendingApproval: 0, closed: 0 },
      caseTypes: [],
      outcomes: { refuted: 0, confirmed: 0, inconclusive: 0 },
      monthlyTrend: [],
      statusDetails: []
    };
  }

  static validateAndCleanData(data: any): ReportsData {
    const fallback = this.createFallbackData();
    
    return {
      stats: {
        totalCases: this.safeFallback(data?.stats?.totalCases, 0),
        closedCases: this.safeFallback(data?.stats?.closedCases, 0),
        openCases: this.safeFallback(data?.stats?.openCases, 0),
        avgResolutionTime: this.safeFallback(data?.stats?.avgResolutionTime, 0),
      },
      statusDistribution: data?.statusDistribution || fallback.statusDistribution,
      caseTypes: Array.isArray(data?.caseTypes) ? data.caseTypes : fallback.caseTypes,
      outcomes: data?.outcomes || fallback.outcomes,
      monthlyTrend: Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : fallback.monthlyTrend,
      statusDetails: Array.isArray(data?.statusDetails) ? data.statusDetails : fallback.statusDetails
    };
  }

  private static safeFallback(value: number | null | undefined, fallback: number): number {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return fallback;
    }
    return value;
  }

  static getColor(key: string): string {
    return this.DEFAULT_COLORS.get(key.toUpperCase()) || '#6b7280';
  }

  static formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  static processCaseTypesData(caseTypes: Array<{ name: string; count: number }>): Array<{
    label: string;
    value: number;
    color: string;
    percentage: number;
  }> {
    if (!Array.isArray(caseTypes) || caseTypes.length === 0) {
      return [];
    }

    const total = caseTypes.reduce((sum, item) => sum + (item.count || 0), 0);
    const colorMap = new Map([
      ['FRAUD', '#ef4444'],
      ['AML', '#f59e0b'],
      ['NONE', '#6b7280'],
      ['OTHER', '#8b5cf6']
    ]);

    return caseTypes.map((item, index) => ({
      label: item.name || 'Unknown',
      value: item.count || 0,
      color: colorMap.get(item.name) || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
      percentage: total > 0 ? ((item.count || 0) / total) * 100 : 0
    }));
  }
}