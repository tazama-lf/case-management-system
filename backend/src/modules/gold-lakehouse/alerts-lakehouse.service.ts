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

  private escapeSqlString(value: string): string {
    // Escape single quotes by doubling them and wrap in quotes
    // prettier-ignore
    return value.split('\'').join('\'\'');
  }

  private clampPositiveInteger(value: number, min = 1, max = 10000): number {
    const parsed = Math.floor(Math.abs(value));
    return Math.max(min, Math.min(max, parsed));
  }

  async getAlertNavigatorData(alertId: number, tenantId = 'DEFAULT', userJwt?: string): Promise<AlertNavigatorDataResponse> {
    try {
      this.logger.log(`Fetching Alert Navigator data for alert: ${alertId}`);

      // Validate inputs to prevent SQL injection
      const safeAlertId = this.clampPositiveInteger(alertId, 1, Number.MAX_SAFE_INTEGER);
      const safeTenantId = this.escapeSqlString(tenantId);

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
            WHERE anr.alert_id  = ${safeAlertId}
              AND anr.tenant_id = '${safeTenantId}'
              AND (
                anr.rule_weight > 0
                OR anr.rule_id = 'EFRuP@1.0.0'
              )
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
            anh.alert_id  = ${safeAlertId}
            AND anh.tenant_id = '${safeTenantId}'

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

      const response = await this.runSqlQuery(sql, 1, undefined, userJwt);
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
          const flowProcessorRule = rulesData.find((r) => r.rule_id === 'EFRuP@1.0.0');
          const triggeredRulesData = rulesData.filter((r) => (r.rule_weight ?? 0) > 0);
          const rulesString = JSON.stringify(
            triggeredRulesData.map((r) => ({
              ruleId: r.rule_id,
              ruleWeight: r.rule_weight,
              subRef: r.rule_sub_ref,
              independentVariable: r.rule_independent_variable,
            })),
          );
          const flowProcessorData = flowProcessorRule?.rule_sub_ref ?? undefined;

          return {
            typologyId: t.typology_id ?? '',
            typologyCfg: t.typology_cfg ?? '',
            typologyScore: t.typology_score ?? 0,
            alertThreshold: t.alert_threshold ?? 0,
            interdictionThreshold: t.interdiction_threshold ?? 0,
            ruleCount: t.rule_count_in_typology ?? 0,
            flowProcessorData,
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
    tenantId: string,
    entityId: string,
    granularity: string,
    userJwt?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    try {
      const safeTenantId = this.escapeSqlString(tenantId);
      const safeEntityId = this.escapeSqlString(entityId);
      let dateFilter = '';

      if (granularity) {
        const startDate = new Date();

        switch (granularity) {
          case 'day':
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        }

        dateFilter = startDate.toISOString();
      }

      const sql = `SELECT CASE WHEN td.debtor_id = '${safeEntityId}' THEN td.debtor_id ELSE td.creditor_id END AS entity_id, 
      CASE WHEN td.debtor_id = '${safeEntityId}' THEN td.debtor_name ELSE td.creditor_name END AS entity_name, 
      CASE WHEN td.debtor_id = '${safeEntityId}' THEN 'DEBTOR' ELSE 'CREDITOR' END AS entity_role, 
      COUNT(DISTINCT a.alert_id) AS total_alerts, COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) AS cases_opened, 
      COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) AS investigations, 
      COALESCE(SUM(t.sar_filings), 0) AS sar_filings, 
      COALESCE(SUM(td.instructed_amount), 0) AS total_value 
      FROM alerts a LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id AND 
      td.tx_type = 'pacs.008.001.10' LEFT JOIN cases c ON a.case_id = c.case_id LEFT JOIN 
      (SELECT case_id, COUNT(DISTINCT task_id) FILTER (WHERE task_type LIKE '%SAR_STR_FILING%') AS sar_filings FROM tasks 
      GROUP BY case_id) t ON c.case_id = t.case_id WHERE a.tenant_id = '${safeTenantId}' AND a.created_at_ts >= '${dateFilter}' AND 
      (td.debtor_id = '${safeEntityId}' OR td.creditor_id = '${safeEntityId}') GROUP BY entity_id, entity_name, entity_role`;

      const response = await this.runSqlQuery(sql, 1, undefined, userJwt);
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
    tenantId: string,
    entityId: string,
    granularity: string,
    userJwt?: string,
  ): Promise<AlertHistoryTimelineResponse> {
    try {
      const safeTenantId = this.escapeSqlString(tenantId);
      const safeEntityId = this.escapeSqlString(entityId);
      let dateFilter = '';

      if (granularity) {
        const startDate = new Date();

        switch (granularity) {
          case 'day':
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        }

        dateFilter = startDate.toISOString();
      }

      const sql = `SELECT DATE_TRUNC('month', a.created_at_ts) as date, 
      COUNT(DISTINCT a.alert_id) as alert_count, 
      COUNT(DISTINCT c.case_id) FILTER (WHERE c.case_id IS NOT NULL) as case_count, 
      COUNT(DISTINCT CASE WHEN c.status LIKE 'STATUS_%' AND c.status != 'STATUS_00_DRAFT' THEN c.case_id END) as investigation_count, 
      COALESCE(SUM(td.instructed_amount), 0) as total_value FROM alerts a LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id 
      AND td.tx_type = 'pacs.008.001.10' LEFT JOIN cases c ON a.case_id = c.case_id WHERE 1=1 AND a.tenant_id = '${safeTenantId}' 
      AND a.created_at_ts >= '${dateFilter}' AND (td.debtor_id = '${safeEntityId}' OR td.creditor_id = '${safeEntityId}') GROUP BY DATE_TRUNC('month', a.created_at_ts) ORDER BY date ASC`;

      const response = await this.runSqlQuery(sql, 1000, undefined, userJwt);
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
    tenantId: string,
    entityId: string,
    granularity: string,
    page: number,
    limit: number,
    userJwt?: string,
  ): Promise<AlertHistoryAlertsResponse> {
    try {
      const safeTenantId = this.escapeSqlString(tenantId);
      const safeEntityId = this.escapeSqlString(entityId);
      let dateFilter = '';

      if (granularity) {
        const startDate = new Date();

        switch (granularity) {
          case 'day':
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;

          case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        }

        dateFilter = startDate.toISOString();
      }

      // Validate and clamp pagination parameters
      const safePage = this.clampPositiveInteger(page, 1, 100000);
      const safeLimit = this.clampPositiveInteger(limit, 1, 1000);
      // const offset = (safePage - 1) * safeLimit;

      const countSql = `SELECT COUNT(DISTINCT a.alert_id) as total FROM alerts a 
      LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id AND td.tx_type = 'pacs.008.001.10' 
      WHERE 1=1 AND a.tenant_id = '${safeTenantId}' AND a.created_at_ts >= '${dateFilter}' AND 
      (td.debtor_id = '${safeEntityId}' OR td.creditor_id = '${safeEntityId}')`;

      const countResponse = await this.runSqlQuery(countSql, 1, undefined, userJwt);

      const total = Number(countResponse.data?.[0]?.total ?? 0);

      const sql = `SELECT DISTINCT a.alert_id, a.created_at_ts as date, a.alert_type_norm as type,
       a.priority_norm as severity, a.alert_status as status, a.case_id, c.status as case_status,
        a.evaluation_id FROM alerts a LEFT JOIN transaction_detail td ON a.tx_original_e2e_id = td.end_to_end_id 
        AND td.tx_type = 'pacs.008.001.10' LEFT JOIN cases c ON a.case_id = c.case_id WHERE 1=1 AND a.tenant_id = '${safeTenantId}' 
        AND a.created_at_ts >= '${dateFilter}' AND (td.debtor_id = '${safeEntityId}' OR td.creditor_id = '${safeEntityId}') 
        ORDER BY date DESC LIMIT 1000 OFFSET 0`;

      const response = await this.runSqlQuery(sql, safeLimit, undefined, userJwt);

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
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
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
