import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/auditLog.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto, DetectedAnomalyDto } from './dto/profile-response.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async generateProfile(dto: GenerateProfileDto, userId: string): Promise<ProfileResponseDto> {
    
    const transactions = this.mockTransactions();
    const peerBaseline = this.mockPeerBaseline();

    
    const filtered = this.applyFilters(transactions, dto.filters);

    
    const metrics = this.calculateMetrics(filtered);
    const outliers = this.detectOutliers(filtered, peerBaseline);
    const summaryTable = this.buildSummaryTable(metrics, outliers);

    
    const visualization = 'trend-chart-placeholder';

    
    const detectedAnomalies = outliers.map(tx => ({
      date: tx.date,
      type: tx.type,
      amount: tx.value,
      description: tx.value > peerBaseline.avgValue ? 'Large transaction flagged' : 'Cross-border anomaly',
      risk: (tx.value > 5000 ? 'High' : tx.value > 2000 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
    }));

    
    await this.prisma.transactionProfile.create({
      data: {
        profile_id: uuidv4(),
        case_id: dto.caseId,
        generated_by: userId,
        filters: dto.filters,
        metrics,
        outliers,
        summary_table: summaryTable,
        notes: dto.notes,
        visualization,
        detected_anomalies: detectedAnomalies,
      },
    });

    await this.auditLog.logAction({
      userId,
      operation: 'generate',
      entityName: 'TransactionProfile',
      actionPerformed: 'PROFILE_GENERATED',
      outcome: 'SUCCESS',
    });

    return {
      caseId: dto.caseId,
      filters: dto.filters,
      metrics,
      outliers,
      summaryTable,
      notes: dto.notes,
      visualization,
      detectedAnomalies,
    };
  }

  async getProfile(caseId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.transactionProfile.findFirst({ where: { case_id: caseId } });
    if (!profile) throw new NotFoundException('Transaction profile not found');

    await this.auditLog.logAction({
      operation: 'view',
      entityName: 'TransactionProfile',
      actionPerformed: 'PROFILE_VIEWED',
      outcome: 'SUCCESS',
    });

    return {
      caseId: profile.case_id,
      filters: typeof profile.filters === 'object' && profile.filters !== null ? profile.filters : undefined,
      metrics: typeof profile.metrics === 'object' && profile.metrics !== null ? profile.metrics : {},
      outliers: typeof profile.outliers === 'object' && profile.outliers !== null ? profile.outliers : undefined,
      summaryTable: typeof profile.summary_table === 'object' && profile.summary_table !== null ? profile.summary_table : undefined,
      notes: typeof profile.notes === 'string' ? profile.notes : undefined,
      visualization: typeof profile.visualization === 'string' ? profile.visualization : undefined,
      detectedAnomalies: Array.isArray(profile.detected_anomalies) ? (profile.detected_anomalies as unknown as DetectedAnomalyDto[]) : [],
    };
  }

 
  private mockTransactions() {
    
    return [
      { date: '2025-09-01', value: 1000, channel: 'ATM', geography: 'Local', type: 'Deposit' },
      { date: '2025-09-15', value: 5000, channel: 'Online', geography: 'Cross-border', type: 'Transfer' },
      { date: '2025-10-10', value: 200, channel: 'Branch', geography: 'Local', type: 'Withdrawal' },
      { date: '2025-11-01', value: 8000, channel: 'Online', geography: 'Cross-border', type: 'Transfer' },
      
    ];
  }

  private mockPeerBaseline() {
    
    return {
      avgVolume: 3000,
      avgValue: 2500,
      avgCrossBorder: 1000,
    };
  }

  private applyFilters(transactions: any[], filters?: Record<string, any>) {
    if (!filters) return transactions;
    return transactions.filter(tx => {
      let match = true;
      if (filters.dateFrom && filters.dateTo) {
        match = match && tx.date >= filters.dateFrom && tx.date <= filters.dateTo;
      }
      if (filters.channel) {
        match = match && tx.channel === filters.channel;
      }
      if (filters.type) {
        match = match && tx.type === filters.type;
      }
      return match;
    });
  }

  private calculateMetrics(transactions: any[]) {
    const totalVolume = transactions.length;
    const totalValue = transactions.reduce((sum, tx) => sum + tx.value, 0);
    const avgTicketSize = totalValue / (totalVolume || 1);
    const crossBorderCount = transactions.filter(tx => tx.geography === 'Cross-border').length;
    return {
      totalVolume,
      totalValue,
      avgTicketSize,
      crossBorderCount,
    };
  }

  private detectOutliers(transactions: any[], peerBaseline: any) {
    
    return transactions.filter(tx => tx.value > peerBaseline.avgValue || (tx.geography === 'Cross-border' && tx.value > peerBaseline.avgCrossBorder));
  }

  private buildSummaryTable(metrics: any, outliers: any[]) {
    return {
      totalVolume: metrics.totalVolume,
      totalValue: metrics.totalValue,
      avgTicketSize: metrics.avgTicketSize,
      deviationPercent: outliers.length ? ((outliers.length / metrics.totalVolume) * 100).toFixed(2) : '0.00',
    };
  }
}
