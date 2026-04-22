import { describe, it, expect } from 'vitest';
import {
  Priority,
  AlertStatus,
  AlertType,
  CaseStatus,
  CaseType,
  CaseCreationType,
  TransactionDetailDTO,
  TransactionDetailRecordDTO,
  TransactionDataResponseDTO,
  type ActionHistory,
  type Alert,
  type Case,
  type AlertsFilter,
  type PaginationResponse,
  type AlertsApiResponse,
  type ManualTriageDto,
  type UpdateAlertDto,
  type ConvertToCaseDto,
  type RiskComponent,
  type RiskCategory,
  type ConvertToCaseResponse,
  type CloseAlertDto,
  type SubmitAlertDto,
  type ConvertToCaseData,
  type AlertTableColumn,
  type AlertTableAction,
  type AlertsSearchFilters,
  type ApiError,
  type ApiErrorResponse,
  type ServiceResponse,
} from '../triage.types';

describe('Triage Types - Constants', () => {
  it('Priority constants should be defined', () => {
    expect(Priority.NEW).toBe('NEW');
    expect(Priority.URGENT).toBe('URGENT');
    expect(Priority.CRITICAL).toBe('CRITICAL');
    expect(Priority.BREACH).toBe('BREACH');
  });

  it('AlertStatus constants should be defined', () => {
    expect(AlertStatus.NEW).toBe('NEW');
    expect(AlertStatus.INVESTIGATING).toBe('INVESTIGATING');
    expect(AlertStatus.CLOSED).toBe('CLOSED');
    expect(AlertStatus.CONVERTED).toBe('CONVERTED');
    expect(AlertStatus.AUTOCLOSED_CONFIRMED).toBe('AUTOCLOSED_CONFIRMED');
    expect(AlertStatus.AUTOCLOSED_REFUTED).toBe('AUTOCLOSED_REFUTED');
    expect(AlertStatus.SENT_FOR_INVESTIGATION).toBe('SENT_FOR_INVESTIGATION');
  });

  it('AlertType constants should be defined', () => {
    expect(AlertType.FRAUD).toBe('FRAUD');
    expect(AlertType.AML).toBe('AML');
    expect(AlertType.FRAUD_AND_AML).toBe('FRAUD_AND_AML');
  });

  it('CaseStatus constants should be defined', () => {
    expect(CaseStatus.STATUS_00_DRAFT).toBe('STATUS_00_DRAFT');
    expect(CaseStatus.STATUS_10_ASSIGNED).toBe('STATUS_10_ASSIGNED');
    expect(CaseStatus.STATUS_20_IN_PROGRESS).toBe('STATUS_20_IN_PROGRESS');
    expect(CaseStatus.STATUS_82_CLOSED_CONFIRMED).toBe(
      'STATUS_82_CLOSED_CONFIRMED',
    );
    expect(CaseStatus.STATUS_99_ABANDONED).toBe('STATUS_99_ABANDONED');
  });

  it('CaseType constants should be defined', () => {
    expect(CaseType.FRAUD).toBe('FRAUD');
    expect(CaseType.AML).toBe('AML');
    expect(CaseType.FRAUD_AND_AML).toBe('FRAUD_AND_AML');
  });

  it('CaseCreationType constants should be defined', () => {
    expect(CaseCreationType.MANUAL).toBe('MANUAL');
    expect(CaseCreationType.ALERT_CONVERSION).toBe('ALERT_CONVERSION');
  });
});

describe('Triage Types - Interfaces', () => {
  it('ActionHistory should be assignable', () => {
    const history: ActionHistory = {
      audit_log_id: 'log-1',
      user_id: 'user-1',
      operation: 'ALERT_CREATED',
      entity_name: 'Alert',
      action_performed: 'Alert created',
      outcome: 'SUCCESS',
      performed_at: '2024-01-01T00:00:00Z',
    };
    expect(history).toBeDefined();
    expect(history.audit_log_id).toBe('log-1');
    expect(history.operation).toBe('ALERT_CREATED');
  });

  it('Alert should be assignable', () => {
    const alert: Alert = {
      alert_id: 'alert-1',
      tenant_id: 'tenant-1',
      priority: Priority.NEW,
      alert_type: AlertType.FRAUD,
      source: 'internal',
      txtp: 'transaction-1',
      message: 'Suspicious transaction detected',
      alert_data: { amount: 1000 },
      transaction: { id: 'txn-1' },
      network_map: { nodes: [] },
      confidence_per: 85.5,
      created_at: '2024-01-01T00:00:00Z',
      prediction_outcome: 'TRUE_POSITIVE',
    };
    expect(alert).toBeDefined();
    expect(alert.alert_id).toBe('alert-1');
    expect(alert.priority).toBe(Priority.NEW);
    expect(alert.confidence_per).toBe(85.5);
  });

  it('Alert with case_id should be assignable', () => {
    const alert: Alert = {
      alert_id: 'alert-2',
      tenant_id: 'tenant-1',
      priority: Priority.URGENT,
      message: 'Alert with case',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 90,
      created_at: '2024-01-01T00:00:00Z',
      case_id: 'case-1',
    };
    expect(alert.case_id).toBe('case-1');
  });

  it('Case should be assignable', () => {
    const caseData: Case = {
      case_id: 'case-1',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-2',
      tenant_id: 'tenant-1',
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      priority: Priority.URGENT,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      case_type: CaseType.FRAUD,
      case_creation_type: CaseCreationType.ALERT_CONVERSION,
    };
    expect(caseData).toBeDefined();
    expect(caseData.case_id).toBe('case-1');
    expect(caseData.status).toBe(CaseStatus.STATUS_20_IN_PROGRESS);
  });

  it('Case with parent_id should be assignable', () => {
    const caseData: Case = {
      case_id: 'case-2',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-2',
      tenant_id: 'tenant-1',
      status: CaseStatus.STATUS_10_ASSIGNED,
      priority: Priority.NEW,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      parent_id: 'case-1',
      case_type: CaseType.AML,
      case_creation_type: CaseCreationType.MANUAL,
    };
    expect(caseData.parent_id).toBe('case-1');
  });

  it('AlertsFilter should be assignable', () => {
    const filter: AlertsFilter = {
      priority: 'URGENT',
      status: 'NEW',
      type: 'FRAUD',
      source: 'internal',
      search: 'test',
      page: 1,
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    expect(filter).toBeDefined();
    expect(filter.priority).toBe('URGENT');
    expect(filter.page).toBe(1);
  });

  it('PaginationResponse should be assignable', () => {
    const pagination: PaginationResponse = {
      currentPage: 2,
      totalPages: 10,
      totalItems: 100,
      pageSize: 10,
    };
    expect(pagination).toBeDefined();
    expect(pagination.currentPage).toBe(2);
    expect(pagination.totalPages).toBe(10);
  });

  it('AlertsApiResponse should be assignable', () => {
    const response: AlertsApiResponse = {
      alerts: [
        {
          alert_id: 'alert-1',
          tenant_id: 'tenant-1',
          priority: Priority.NEW,
          message: 'Test alert',
          alert_data: {},
          transaction: {},
          network_map: {},
          confidence_per: 50,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        pageSize: 10,
      },
    };
    expect(response).toBeDefined();
    expect(response.alerts).toHaveLength(1);
    expect(response.pagination.totalItems).toBe(1);
  });

  it('ManualTriageDto should be assignable', () => {
    const dto: ManualTriageDto = {
      confidence_per: 90,
      priority: Priority.URGENT,
      priorityScore: 85,
      alertType: AlertType.FRAUD,
      predictionOutcome: 'TRUE_POSITIVE',
      note: 'Manual review completed',
      status: CaseStatus.STATUS_20_IN_PROGRESS,
    };
    expect(dto).toBeDefined();
    expect(dto.priorityScore).toBe(85);
    expect(dto.predictionOutcome).toBe('TRUE_POSITIVE');
  });

  it('UpdateAlertDto should be assignable', () => {
    const dto: UpdateAlertDto = {
      confidence_per: 75,
      priority: Priority.CRITICAL,
      alert_type: AlertType.AML,
      note: 'Updated alert',
    };
    expect(dto).toBeDefined();
    expect(dto.confidence_per).toBe(75);
    expect(dto.note).toBe('Updated alert');
  });

  it('ConvertToCaseDto should be assignable', () => {
    const dto: ConvertToCaseDto = {
      priority: Priority.URGENT,
      caseType: 'FRAUD',
      caseOwnerUserId: 'user-1',
      riskCategory: 'high',
      riskScore: 85,
      riskComponents: [
        { id: 'comp-1', wght: 0.5 },
        { id: 'comp-2', wght: 0.5 },
      ],
    };
    expect(dto).toBeDefined();
    expect(dto.caseType).toBe('FRAUD');
    expect(dto.riskComponents).toHaveLength(2);
  });

  it('RiskComponent should be assignable', () => {
    const component: RiskComponent = {
      id: 'risk-1',
      wght: 0.75,
    };
    expect(component).toBeDefined();
    expect(component.wght).toBe(0.75);
  });

  it('RiskCategory should be assignable', () => {
    const category: RiskCategory = {
      id: 'category-1',
      result: 85.5,
      ruleResults: [
        { id: 'rule-1', wght: 0.5 },
        { id: 'rule-2', wght: 0.5 },
      ],
    };
    expect(category).toBeDefined();
    expect(category.result).toBe(85.5);
    expect(category.ruleResults).toHaveLength(2);
  });

  it('ConvertToCaseResponse should be assignable', () => {
    const response: ConvertToCaseResponse = {
      case_id: 'case-1',
      alert_id: 'alert-1',
      message: 'Case created successfully',
      success: true,
    };
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.case_id).toBe('case-1');
  });

  it('CloseAlertDto should be assignable', () => {
    const dto: CloseAlertDto = {
      status: AlertStatus.CLOSED,
      reason: 'False positive',
    };
    expect(dto).toBeDefined();
    expect(dto.status).toBe(AlertStatus.CLOSED);
    expect(dto.reason).toBe('False positive');
  });

  it('SubmitAlertDto should be assignable', () => {
    const dto: SubmitAlertDto = {
      result: {
        message: 'Alert submitted',
        report: { id: 'report-1' },
        transaction: { id: 'txn-1' },
        networkMap: { nodes: [] },
      },
    };
    expect(dto).toBeDefined();
    expect(dto.result.message).toBe('Alert submitted');
  });

  it('ConvertToCaseData should be assignable', () => {
    const data: ConvertToCaseData = {
      caseId: 'case-1',
      assignedTo: 'user-1',
      caseOwnerUserId: 'user-2',
      priority: Priority.URGENT,
      caseType: CaseType.FRAUD,
      linkedCases: ['case-2', 'case-3'],
      notes: 'Conversion notes',
      alertId: 'alert-1',
    };
    expect(data).toBeDefined();
    expect(data.priority).toBe(Priority.URGENT);
    expect(data.linkedCases).toHaveLength(2);
  });

  it('AlertTableColumn should be assignable', () => {
    const column: AlertTableColumn = {
      key: 'alert_id',
      header: 'Alert ID',
      sortable: true,
      width: '200px',
      align: 'left',
    };
    expect(column).toBeDefined();
    expect(column.key).toBe('alert_id');
    expect(column.sortable).toBe(true);
  });

  it('AlertTableAction should be assignable', () => {
    const action: AlertTableAction = {
      label: 'View Details',
      onClick: () => {},
      color: 'blue',
    };
    expect(action).toBeDefined();
    expect(action.label).toBe('View Details');
  });

  it('AlertsSearchFilters should be assignable', () => {
    const filters: AlertsSearchFilters = {
      query: 'test',
      source: 'internal',
      type: 'FRAUD',
      priority: 'URGENT',
      status: 'NEW',
      timeRange: '7d',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    };
    expect(filters).toBeDefined();
    expect(filters.query).toBe('test');
    expect(filters.status).toBe('NEW');
  });

  it('ApiError should be assignable', () => {
    const error: ApiError = {
      message: 'Something went wrong',
      statusCode: 500,
      error: 'Internal Server Error',
      details: { field: 'value' },
    };
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('Something went wrong');
  });

  it('ApiErrorResponse should be assignable', () => {
    const error: ApiErrorResponse = {
      message: 'Validation failed',
      statusCode: 400,
      error: 'Bad Request',
      timestamp: '2024-01-01T00:00:00Z',
      path: '/api/alerts',
      details: { field: 'alert_id', reason: 'required' },
    };
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
    expect(error.path).toBe('/api/alerts');
  });

  it('ServiceResponse with data should be assignable', () => {
    const response: ServiceResponse<Alert> = {
      data: {
        alert_id: 'alert-1',
        tenant_id: 'tenant-1',
        priority: Priority.NEW,
        message: 'Test',
        alert_data: {},
        transaction: {},
        network_map: {},
        confidence_per: 50,
        created_at: '2024-01-01T00:00:00Z',
      },
      success: true,
      loading: false,
    };
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data?.alert_id).toBe('alert-1');
  });

  it('ServiceResponse with error should be assignable', () => {
    const response: ServiceResponse<Alert> = {
      error: {
        message: 'Failed to fetch',
        statusCode: 500,
      },
      success: false,
      loading: false,
    };
    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    expect(response.error?.message).toBe('Failed to fetch');
  });
});

describe('Triage Types - DTO Classes', () => {
  it('TransactionDetailDTO can be instantiated and assigned properties', () => {
    const dto = new TransactionDetailDTO();
    dto.pk = 'pk-1';
    dto.transaction_id = 100;
    dto.end_to_end_id = 'e2e-1';
    dto.tenant_id = 'tenant-1';
    dto.tx_tenant_id = 'tx-tenant-1';
    dto.tx_type = 'TRANSFER';
    dto.tx_msg_id = 'msg-1';
    dto.tx_event_ts = '2024-01-01T00:00:00Z';
    dto.tx_event_date = '2024-01-01';
    dto.debtor_name = 'John Doe';
    dto.debtor_id = 'debtor-1';
    dto.creditor_name = 'Jane Doe';
    dto.creditor_id = 'creditor-1';
    dto.debtor_account_id = 'acc-1';
    dto.creditor_account_id = 'acc-2';
    dto.instructed_amount = 5000;
    dto.instructed_currency = 'USD';
    dto.interbank_settlement_amount = 4999;
    dto.interbank_settlement_currency = 'USD';
    dto.exchange_rate = 1.0;
    dto.instg_mmb_id = 'instg-1';
    dto.instd_mmb_id = 'instd-1';
    dto.charge_count = 1;
    dto.charge_total_amount = 1;
    dto.charge_currency = 'USD';
    dto.source_file_path = '/path/to/file';
    dto.record_hash = 'hash-abc';
    dto.ingested_at_ts = '2024-01-01T00:00:00Z';

    expect(dto).toBeInstanceOf(TransactionDetailDTO);
    expect(dto.pk).toBe('pk-1');
    expect(dto.transaction_id).toBe(100);
    expect(dto.debtor_name).toBe('John Doe');
    expect(dto.instructed_amount).toBe(5000);
  });

  it('TransactionDetailDTO supports null values', () => {
    const dto = new TransactionDetailDTO();
    dto.debtor_name = null;
    dto.creditor_name = null;
    dto.debtor_id = null;
    dto.creditor_id = null;
    dto.debtor_account_id = null;
    dto.creditor_account_id = null;
    dto.instructed_amount = null;
    dto.instructed_currency = null;
    dto.interbank_settlement_amount = null;
    dto.interbank_settlement_currency = null;
    dto.exchange_rate = null;

    expect(dto.debtor_name).toBeNull();
    expect(dto.instructed_amount).toBeNull();
    expect(dto.exchange_rate).toBeNull();
  });

  it('TransactionDetailRecordDTO can be instantiated and assigned properties', () => {
    const dto = new TransactionDetailRecordDTO();
    dto._hoodie_commit_time = '2024-01-01T00:00:00Z';
    dto._hoodie_commit_seqno = '1';
    dto._hoodie_record_key = 'key-1';
    dto._hoodie_partition_path = '/partition/1';
    dto._hoodie_file_name = 'file-1.parquet';
    dto.pk = 'pk-1';
    dto.transaction_id = 200;
    dto.end_to_end_id = 'e2e-2';
    dto.tenant_id = 'tenant-1';
    dto.tx_tenant_id = 'tx-tenant-1';
    dto.tx_type = 'PAYMENT';
    dto.tx_msg_id = 'msg-2';
    dto.tx_event_ts = '2024-01-01T00:00:00Z';
    dto.tx_event_date = '2024-01-01';
    dto.debtor_name = 'Alice';
    dto.debtor_id = 'debtor-2';
    dto.creditor_name = 'Bob';
    dto.creditor_id = 'creditor-2';
    dto.debtor_account_id = 'acc-3';
    dto.creditor_account_id = 'acc-4';
    dto.instructed_amount = 3000;
    dto.instructed_currency = 'EUR';
    dto.interbank_settlement_amount = 2999;
    dto.interbank_settlement_currency = 'EUR';
    dto.exchange_rate = 1.1;
    dto.instg_mmb_id = 'instg-2';
    dto.instd_mmb_id = 'instd-2';
    dto.charge_count = 2;
    dto.charge_total_amount = 2;
    dto.charge_currency = 'EUR';
    dto.source_file_path = '/path/to/file2';
    dto.record_hash = 'hash-def';
    dto.ingested_at_ts = '2024-01-01T00:00:00Z';

    expect(dto).toBeInstanceOf(TransactionDetailRecordDTO);
    expect(dto._hoodie_commit_time).toBe('2024-01-01T00:00:00Z');
    expect(dto._hoodie_file_name).toBe('file-1.parquet');
    expect(dto.transaction_id).toBe(200);
  });

  it('TransactionDataResponseDTO can be instantiated and assigned properties', () => {
    const record = new TransactionDetailRecordDTO();
    record.pk = 'pk-1';
    record.transaction_id = 1;

    const dto = new TransactionDataResponseDTO();
    dto.status = 'SUCCESS';
    dto.code = 200;
    dto.table = 'transactions';
    dto.row_count = 1;
    dto.data = [record];

    expect(dto).toBeInstanceOf(TransactionDataResponseDTO);
    expect(dto.status).toBe('SUCCESS');
    expect(dto.code).toBe(200);
    expect(dto.table).toBe('transactions');
    expect(dto.row_count).toBe(1);
    expect(dto.data).toHaveLength(1);
    expect(dto.data[0]).toBeInstanceOf(TransactionDetailRecordDTO);
  });
});
