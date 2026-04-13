import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { AlertHistoryTimelineResponse } from './types/IAlertHistoryTimeline.types';
import { AlertHistoryAlertsResponse } from './types/IAlertHistory.types';
import { AlertNavigatorDataResponse } from './types/alert-navigator.types';
import type { RawRuleRow } from './types/raw-rule-row.types';
import type { RawTypologyRow } from './types/raw-typologies-row.types';

@Injectable()
export class AlertsLakehouseService extends GoldLakehouseService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Required for NestJS dependency injection in subclasses
  constructor(httpService: HttpService, configService: ConfigService) {
    super(httpService, configService);
  }

  async getAlertNavigatorData(alertId: number, tenantId = 'DEFAULT'): Promise<AlertNavigatorDataResponse> {
    try {
      this.logger.log(`Fetching Alert Navigator data for alert: ${alertId}`);

      const sql = `
        WITH rules_agg AS (
            SELECT
                anr.alert_id,
                anr.tenant_id,
                anr.typology_id,
                anr.typology_cfg,
                COLLECT_LIST(
                    NAMED_STRUCT(
                        'rule_id',                   anr.rule_id,
                        'rule_cfg',                  anr.rule_cfg,
                        'rule_weight',               anr.rule_weight,
                        'rule_independent_variable', anr.rule_independent_variable,
                        'rule_sub_ref',              anr.rule_sub_ref,
                        'rule_processing_time_ms',   anr.rule_processing_time_ms,
                        'rule_tenant_id',            anr.rule_tenant_id
                    )
                ) AS rules
            FROM alert_navigator_rules anr
            WHERE anr.alert_id  = ${alertId}
              AND anr.tenant_id = '${tenantId}'
              AND anr.rule_weight > 0
            GROUP BY
                anr.alert_id,
                anr.tenant_id,
                anr.typology_id,
                anr.typology_cfg
        )

        SELECT
            anh.alert_id,
            anh.tenant_id,
            anh.case_id,
            anh.tx_msg_id,
            anh.tx_type,
            anh.alert_timestamp,
            anh.alert_reason,
            anh.alert_type,
            anh.prediction_outcome,
            anh.priority,
            anh.priority_score,
            anh.evaluation_id,
            anh.alert_status,
            anh.transaction_status,
            anh.transaction_amount,
            anh.transaction_currency,
            anh.transaction_id,
            anh.end_to_end_id,
            anh.block_or_override_status,
            anh.alert_date,
            COLLECT_LIST(
                NAMED_STRUCT(
                    'typology_id',               ant.typology_id,
                    'typology_cfg',              ant.typology_cfg,
                    'typology_score',            ant.typology_score,
                    'typology_review',           ant.typology_review,
                    'typology_processing_time_ms', ant.typology_processing_time_ms,
                    'typology_tenant_id',        ant.typology_tenant_id,
                    'flow_processor',            ant.flow_processor,
                    'alert_threshold',           ant.alert_threshold,
                    'interdiction_threshold',    ant.interdiction_threshold,
                    'rule_count_in_typology',    ant.rule_count_in_typology,
                    'rules',                     ra.rules
                )
            ) AS typologies

        FROM alert_navigator_header anh

        LEFT JOIN alert_navigator_typologies ant
            ON  ant.alert_id  = anh.alert_id
            AND ant.tenant_id = anh.tenant_id

        LEFT JOIN rules_agg ra
            ON  ra.alert_id     = ant.alert_id
            AND ra.tenant_id    = ant.tenant_id
            AND ra.typology_id  = ant.typology_id
            AND ra.typology_cfg = ant.typology_cfg

        WHERE
            anh.alert_id  = ${alertId}
            AND anh.tenant_id = '${tenantId}'

        GROUP BY
            anh.alert_id,
            anh.tenant_id,
            anh.case_id,
            anh.tx_msg_id,
            anh.tx_type,
            anh.alert_timestamp,
            anh.alert_reason,
            anh.alert_type,
            anh.prediction_outcome,
            anh.priority,
            anh.priority_score,
            anh.evaluation_id,
            anh.alert_status,
            anh.transaction_status,
            anh.transaction_amount,
            anh.transaction_currency,
            anh.transaction_id,
            anh.end_to_end_id,
            anh.block_or_override_status,
            anh.alert_date
      `;

      const response = await this.runSqlQuery(sql, 1);
      const rawData = response?.data?.[0];

      if (!rawData) {
        throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
      }

      const data = this.stripHudiMetadata(rawData);

      const alertMetadata = {
        alertId: Number(data.alert_id),
        transactionId: String(data.transaction_id ?? ''),
        timestamp: String(data.alert_timestamp ?? ''),
        transactionType: String(data.tx_type ?? ''),
        amount: Number(data.transaction_amount ?? 0),
        currency: String(data.transaction_currency ?? ''),
        status: String(data.alert_status ?? ''),
        reason: String(data.alert_reason ?? ''),
        blockReason: String(data.block_or_override_status ?? ''),
        evaluationId: String(data.evaluation_id ?? ''),
      };

      const typologiesData = this.safeParseArray<RawTypologyRow>(data.typologies);
      const typologies = typologiesData
        .filter((t) => t.typology_id !== null)
        .map((t) => {
          const rulesData = this.safeParseArray<RawRuleRow>(t.rules);
          const rulesString = JSON.stringify(
            rulesData.map((r) => ({
              ruleId: r.rule_id,
              ruleWeight: r.rule_weight,
              subRef: r.rule_sub_ref,
            })),
          );

          return {
            typologyId: t.typology_id ?? '',
            typologyCfg: t.typology_cfg ?? '',
            typologyScore: t.typology_score ?? 0,
            alertThreshold: t.alert_threshold ?? 0,
            interdictionThreshold: t.interdiction_threshold ?? 0,
            ruleCount: t.rule_count_in_typology ?? 0,
            rules: rulesString,
          };
        });

      // Calculate statistics manually
      const totalTypologies = typologies.length;
      const totalRules = typologies.reduce((sum, t) => {
        try {
          const rulesArray = JSON.parse(t.rules);
          return sum + (Array.isArray(rulesArray) ? rulesArray.length : 0);
        } catch {
          return sum;
        }
      }, 0);

      return {
        alertMetadata,
        typologies,
        statistics: {
          totalTypologies,
          totalRules,
        },
        meta: {
          alertId,
          tenantId,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

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

  /**
   * Coerces a lakehouse COLLECT_LIST result to a plain array.
   *
   * Server-side Spark/Hudi API instances sometimes serialize COLLECT_LIST
   * results as a JSON string instead of an already-parsed array.  This helper
   * transparently handles both representations so the calling code never has
   * to distinguish between them.
   */
  private safeParseArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        this.logger.warn(`safeParseArray: failed to parse string as JSON array. Preview: ${value.slice(0, 100)}`);
        return [];
      }
    }
    return [];
  }
}
