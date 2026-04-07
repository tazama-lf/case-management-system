import type { RawRuleRow } from './raw-rule-row.types';

export interface RawTypologyRow {
  typology_id: string | null;
  typology_cfg: string | null;
  typology_score: number | null;
  typology_review: boolean | null;
  typology_processing_time_ms: number | null;
  typology_tenant_id: string | null;
  flow_processor: string | null;
  alert_threshold: number | null;
  interdiction_threshold: number | null;
  rule_count_in_typology: number | null;
  rules: RawRuleRow[] | string | null;
}
