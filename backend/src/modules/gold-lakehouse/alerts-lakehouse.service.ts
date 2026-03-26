import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { AlertHistoryTimelineResponse } from './types/IAlertHistoryTimeline.types';
import { AlertHistoryAlertsResponse } from './types/IAlertHistory.types';

@Injectable()
export class AlertsLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getAlertNavigatorMetrics(
    alertId: number,
    tenantId = 'DEFAULT',
  ): Promise<{
    total_typologies: number;
    total_rules: number;
    avg_typology_score: number | null;
    alertId: number;
    tenantId: string;
  }> {
    try {
      this.logger.log(`Fetching Alert Navigator metrics for alert: ${alertId}`);

      const sql = `
      SELECT
        COUNT(DISTINCT t.typology_id) AS total_typologies,
        COUNT(DISTINCT r.rule_id)     AS total_rules,
        AVG(t.typology_score)         AS avg_typology_score
      FROM alert_navigator_header h
      LEFT JOIN alert_navigator_typologies t
        ON t.alert_id = h.alert_id
      AND t.tenant_id = h.tenant_id
      LEFT JOIN alert_navigator_rules r
        ON r.alert_id = h.alert_id
      AND r.tenant_id = h.tenant_id
      AND r.rule_weight > 0
      WHERE h.alert_id = ${alertId}
        AND h.tenant_id = '${tenantId}'
      `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response?.data?.[0];

      return {
        total_typologies: Number(row?.total_typologies ?? 0),
        total_rules: Number(row?.total_rules ?? 0),
        avg_typology_score: row?.avg_typology_score === null ? null : Number(row.avg_typology_score),
        alertId,
        tenantId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Alert Navigator metrics: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Alert Navigator metrics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertNavigatorData(
    alertId: number,
    tenantId = 'DEFAULT',
  ): Promise<{
    alertMetadata: {
      alertId: number;
      transactionId: string;
      timestamp: string;
      transactionType: string;
      amount: number;
      currency: string;
      status: string;
      reason: string;
      blockReason: string;
    };
    typologies: Array<{
      typologyId: string;
      typologyCfg: string;
      typologyScore: number;
      alertThreshold: number;
      interdictionThreshold: number;
      ruleCount: number;
      rules: string;
    }>;
    statistics: {
      totalTypologies: number;
      totalRules: number;
      avgScore: number;
    };
    meta: {
      alertId: number;
      tenantId: string;
    };
  }> {
    try {
      this.logger.log(`Fetching Alert Navigator data for alert: ${alertId}`);

      // Fetch alert with transaction data using SQL JOIN
      const alertWithTransactionResponse = await this.runSqlQuery(
        `
        SELECT
          h.*,
          a.alert_id as alert_alert_id,
          a.alert_status,
          a.tx_type as alert_tx_type,
          a.tx_amount as alert_tx_amount,
          a.tx_ccy as alert_tx_ccy,
          a.created_at_ts,
          t.transaction_id as tx_transaction_id,
          t.end_to_end_id,
          t.tx_msg_id,
          t.tx_amount,
          t.tx_ccy,
          t.event_ts,
          t.tx_status,
          t.tx_type,
          t.instg_mmb_id,
          t.instd_mmb_id
        FROM alert_navigator_header h
        LEFT JOIN alerts a ON h.alert_id = a.alert_id AND h.tenant_id = a.tenant_id
        LEFT JOIN transactions t ON (
          (a.tx_msg_id IS NOT NULL AND t.tx_msg_id = a.tx_msg_id) OR
          (h.end_to_end_id IS NOT NULL AND t.end_to_end_id = h.end_to_end_id) OR
          (h.transaction_id IS NOT NULL AND t.transaction_id = h.transaction_id)
        ) AND t.tenant_id = h.tenant_id
        WHERE h.alert_id = ${alertId}
          AND h.tenant_id = '${tenantId}'
        LIMIT 1
        `,
        1,
      );

      const [typologiesResponse] = await Promise.all([
        this.query({
          table_name: 'alert_navigator_typologies',
          filters: { alert_id: alertId, tenant_id: tenantId },
        }),
      ]);

      // Fetch rules with rule_weight > 0 using SQL
      const rulesResponse = await this.runSqlQuery(
        `
        SELECT r.*, rules.rule_desc
        FROM alert_navigator_rules r
        LEFT JOIN rules ON r.rule_id = rules.rule_id
        WHERE r.alert_id = ${alertId}
          AND r.tenant_id = '${tenantId}'
          AND r.rule_weight > 0
        `,
        1000,
      );

      const combinedRaw = alertWithTransactionResponse?.data?.[0];

      if (!combinedRaw) {
        throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
      }

      const combined = this.stripHudiMetadata(combinedRaw);
      const typologiesRaw = typologiesResponse.data;
      const rulesRaw = rulesResponse?.data ?? [];

      // Alert Metadata
      const alertMetadata = {
        alertId: Number(combined.alert_id),
        transactionId: String(combined.tx_transaction_id) || String(combined.end_to_end_id) || String(combined.transaction_id),
        timestamp: String(combined.created_at_ts) || String(combined.ingested_at_ts),
        transactionType: String(combined.alert_tx_type) || String(combined.tx_type),
        amount: Number(combined.alert_tx_amount) || Number(combined.tx_amount),
        currency: String(combined.alert_tx_ccy) || String(combined.tx_ccy),
        status: String(combined.alert_status),
        reason: String(combined.alert_reason),
        blockReason: String(combined.block_or_override_status),
      };

      // Typologies
      const typologies = typologiesRaw.map((t) => {
        const typology = this.stripHudiMetadata(t);

        // Find rules that belong to this typology
        const typologyRules = rulesRaw
          .filter((r) => {
            const rule = this.stripHudiMetadata(r);
            return rule.typology_cfg === typology.typology_cfg;
          })
          .map((r) => {
            const rule = this.stripHudiMetadata(r);
            return {
              ruleId: rule.rule_id,
              ruleDesc: rule.rule_desc,
              ruleWeight: rule.rule_weight,
              subRef: rule.rule_sub_ref,
            };
          });

        return {
          typologyId: String(typology.typology_id),
          typologyCfg: String(typology.typology_cfg),
          typologyScore: Number(typology.typology_score),
          alertThreshold: Number(typology.alert_threshold),
          interdictionThreshold: Number(typology.interdiction_threshold),
          ruleCount: Number(typology.rule_count_in_typology),
          rules: String(typologyRules),
        };
      });

      // Calculate summary statistics
      const totalTypologies = typologies.length;
      const totalRules = rulesRaw.length;
      const avgScore = totalTypologies > 0 ? typologies.reduce((sum, t) => sum + t.typologyScore, 0) / totalTypologies : 0;

      return {
        alertMetadata,
        typologies,
        statistics: {
          totalTypologies,
          totalRules: Number(totalRules),
          avgScore: Math.round(avgScore * 100) / 100,
        },
        meta: {
          alertId,
          tenantId,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error fetching Alert Navigator data: ${errorMessage}`, errorStack);
      throw new HttpException('Failed to fetch Alert Navigator data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertHistorySummary(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const sql = `
      SELECT
        COUNT(DISTINCT a.alert_id) as total_alerts,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) as cases_opened,
        COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) as investigations,
        COUNT(DISTINCT t.task_id) FILTER (WHERE t.task_type LIKE '%SAR_STR_FILING%') as sar_filings,
        COALESCE(SUM(td.instructed_amount), 0) as total_value
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id
      LEFT JOIN tasks t ON c.case_id = t.case_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      `;

      const response = await this.runSqlQuery(sql, 1);
      const row = response.data?.[0] ?? {};

      return {
        totalAlerts: Number(row.total_alerts ?? 0),
        casesOpened: Number(row.cases_opened ?? 0),
        investigations: Number(row.investigations ?? 0),
        sarFilings: Number(row.sar_filings ?? 0),
        totalValue: parseFloat(row.total_value) || 0,
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching alert history summary', errorStack);
      throw new HttpException('Failed to fetch alert history summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertHistoryTimeline(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
    granularity = 'day',
  ): Promise<AlertHistoryTimelineResponse> {
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const sql = `
      SELECT
        DATE_TRUNC('${granularity}', a.created_at_ts) as date,
        COUNT(DISTINCT a.alert_id) as alert_count,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) as case_count,
        COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) as investigation_count,
        COALESCE(SUM(td.instructed_amount), 0) as total_value
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      GROUP BY DATE_TRUNC('${granularity}', a.created_at_ts)
      ORDER BY date ASC
      `;

      const response = await this.runSqlQuery(sql, 1000);
      const rows = response.data ?? [];

      const alertCountOverTime = rows.map((r) => ({
        date: r.date,
        alerts: Number(r.alert_count ?? 0),
        cases: Number(r.case_count ?? 0),
        investigations: Number(r.investigation_count ?? 0),
      }));

      const alertValueOverTime = rows.map((r) => ({
        date: r.date,
        totalValue: parseFloat(r.total_value) || 0,
      }));

      return {
        alertCountOverTime,
        alertValueOverTime,
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching alert history timeline', errorStack);
      throw new HttpException('Failed to fetch alert history timeline', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAlertHistoryAlerts(
    endToEndId?: string,
    tenantId?: string,
    dateRange?: string,
    page = 1,
    limit = 20,
  ): Promise<AlertHistoryAlertsResponse> {
    try {
      const effectiveEndToEndId = endToEndId ?? this.alertHistoryFallbackE2EId;
      const endToEndFilter = effectiveEndToEndId ? `AND a.tx_original_e2e_id = '${effectiveEndToEndId}'` : '';
      const tenantFilter = tenantId ? `AND a.tenant_id = '${tenantId}'` : '';

      let dateFilter = '';
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90days':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter = `AND a.created_at_ts >= '${startDate.toISOString()}'`;
        }
      }

      const offset = (page - 1) * limit;

      const countSql = `
      SELECT COUNT(DISTINCT a.alert_id) as total
      FROM alerts a
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      `;

      const countResponse = await this.runSqlQuery(countSql, 1);
      const total = Number(countResponse.data?.[0]?.total ?? 0);

      const sql = `
      SELECT DISTINCT
        a.alert_id,
        a.created_at_ts as date,
        a.alert_type_norm as type,
        a.priority_norm as severity,
        a.alert_status as status,
        a.case_id,
        c.status as case_status,
        a.evaluation_id
      FROM alerts a
      LEFT JOIN cases c ON a.case_id = c.case_id
      WHERE 1=1
        ${endToEndFilter}
        ${tenantFilter}
        ${dateFilter}
      ORDER BY date DESC
      LIMIT ${limit} OFFSET ${offset}
      `;

      const response = await this.runSqlQuery(sql, limit);
      const rows = response.data ?? [];

      const alerts = rows.map((r) => {
        let outcome = 'Pending';
        if (r.case_status) {
          if (r.case_status.includes('COMPLETED')) outcome = 'Closed';
          else if (r.case_status.includes('DRAFT')) outcome = 'Draft';
          else if (r.case_status.includes('ASSIGNED') ?? r.case_status.includes('PROGRESS')) outcome = 'Investigating';
        }

        return {
          alertId: r.alert_id,
          date: r.date,
          type: r.type ?? 'Unknown',
          severity: r.severity ?? 'Unknown',
          status: r.status ?? 'Unknown',
          caseId: r.case_id ?? null,
          outcome,
          actions: {
            viewAlertNavigator: `/alert-navigator/${r.alert_id}`,
            viewTransactionDetails: r.evaluation_id ? `/transaction-detail/${r.evaluation_id}` : null,
          },
        };
      });

      return {
        alerts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching alert history alerts', errorStack);
      throw new HttpException('Failed to fetch alert history alerts', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
