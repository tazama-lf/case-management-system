export interface RawRuleRow {
  rule_id: string | null;
  rule_cfg: string | null;
  rule_weight: number | null;
  rule_independent_variable: unknown;
  rule_sub_ref: string | null;
  rule_processing_time_ms: number | null;
  rule_tenant_id: string | null;
}
