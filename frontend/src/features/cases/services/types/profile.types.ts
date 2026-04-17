export interface GenerateProfileRequest {
  tenantId: string;
}
export interface TransactionRecordDto {
  tx_msg_id: number;
  event_date: string; // ISO date
  tx_amount: number;
  tx_ccy: string;
  tx_type: string;
  is_alerted: number;
  is_investigated: number;
  cum_tx_count: number;
  cum_tx_amount: number;
  entity_role: string;
  entity_id: string;
  entity_type: string;

  // optional depending on query
  debtor_name?: string;
  creditor_name?: string;
}

export interface SqlResponseDto {
  status: string;
  code: number;
  query: string;
  row_count: number;
  data: TransactionRecordDto[];
}

export interface GenerateProfileResponse {
  tenantId: string;
  transactionCreditorResp: SqlResponseDto;
  transactionDebtorResp: SqlResponseDto;

}