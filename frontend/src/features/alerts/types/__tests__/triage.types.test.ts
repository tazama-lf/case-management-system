import { describe, it, expect } from 'vitest';
import {
  Priority,
  AlertStatus,
  AlertType,
  CaseStatus,
  CaseType,
  CaseCreationType,
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
    expect(AlertType.NONE).toBe('NONE');
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

