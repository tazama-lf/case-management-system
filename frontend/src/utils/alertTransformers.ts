import type {
  Alert as TriageAlert,
  Priority,
  AlertStatus,
} from '../types/triage.types';
import type { Alert as UIAlert } from '../types/alertsdashboard.types';

/**
 * Transform backend Alert to UI Alert format
 */
export function transformBackendAlertToUI(backendAlert: TriageAlert): UIAlert {
  const transformedAlert: UIAlert = {
    // Backend fields
    alert_id: backendAlert.alert_id,
    tenant_id: backendAlert.tenant_id || 'default-tenant',
    priority: backendAlert.priority,
    alert_type: backendAlert.alert_type,
    source: backendAlert.source,
    txtp: backendAlert.txtp,
    message: backendAlert.message,
    alert_data: backendAlert.alert_data,
    transaction: backendAlert.transaction,
    network_map: backendAlert.network_map,
    alert_status: backendAlert.alert_status,
    confidence_per: backendAlert.confidence_per,
    created_at: backendAlert.created_at,
    case_id: backendAlert.case_id,

    // UI-specific mapped fields
    id: backendAlert.alert_id,
    transactionId: extractTransactionId(backendAlert.transaction),
    title: backendAlert.message,
    description: backendAlert.message,
    type: backendAlert.alert_type || 'Unknown',
    severity: mapPriorityToSeverity(backendAlert.priority),
    riskScore: backendAlert.confidence_per,
    confidence: backendAlert.confidence_per,
    status: mapAlertStatusToUIStatus(backendAlert.alert_status),
    createdAt: backendAlert.created_at,
    updatedAt: backendAlert.created_at,
    lastUpdated: backendAlert.created_at,
    assignedTo: undefined,
    assignee: undefined,
    amount: extractAmount(backendAlert.transaction),
    currency: extractCurrency(backendAlert.transaction),
  };

  return transformedAlert;
}

/**
 * Transform UI Alert back to backend Alert format
 */
export function transformUIAlertToBackend(uiAlert: UIAlert): TriageAlert {
  return {
    alert_id: uiAlert.alert_id,
    tenant_id: uiAlert.tenant_id,
    priority: uiAlert.priority,
    alert_type: uiAlert.alert_type as any,
    source: uiAlert.source,
    txtp: uiAlert.txtp,
    message: uiAlert.message,
    alert_data: uiAlert.alert_data,
    transaction: uiAlert.transaction,
    network_map: uiAlert.network_map,
    alert_status: uiAlert.alert_status,
    confidence_per: uiAlert.confidence_per,
    created_at: uiAlert.created_at,
    case_id: uiAlert.case_id,
  };
}

/**
 * Map Priority enum to UI severity string
 */
function mapPriorityToSeverity(
  priority: Priority,
): 'low' | 'medium' | 'high' | 'critical' {
  switch (priority) {
    case 'LOW':
      return 'low';
    case 'MEDIUM':
      return 'medium';
    case 'HIGH':
      return 'high';
    case 'CRITICAL':
      return 'critical';
    default:
      return 'medium';
  }
}

/**
 * Map UI severity back to Priority enum
 */
export function mapSeverityToPriority(
  severity: 'low' | 'medium' | 'high' | 'critical',
): Priority {
  switch (severity) {
    case 'low':
      return 'LOW';
    case 'medium':
      return 'MEDIUM';
    case 'high':
      return 'HIGH';
    case 'critical':
      return 'CRITICAL';
    default:
      return 'MEDIUM';
  }
}

/**
 * Map AlertStatus enum to UI status string
 */
function mapAlertStatusToUIStatus(
  status: AlertStatus,
):
  | 'new'
  | 'investigating'
  | 'closed'
  | 'converted'
  | 'autoclosed_confirmed'
  | 'autoclosed_refuted'
  | 'sent_for_investigation' {
  switch (status) {
    case 'NEW':
      return 'new';
    case 'INVESTIGATING':
      return 'investigating';
    case 'CLOSED':
      return 'closed';
    case 'CONVERTED':
      return 'converted';
    case 'AUTOCLOSED_CONFIRMED':
      return 'autoclosed_confirmed';
    case 'AUTOCLOSED_REFUTED':
      return 'autoclosed_refuted';
    case 'SENT_FOR_INVESTIGATION':
      return 'sent_for_investigation';
    default:
      return 'new';
  }
}

/**
 * Map UI status back to AlertStatus enum
 */
export function mapUIStatusToAlertStatus(
  status:
    | 'new'
    | 'investigating'
    | 'closed'
    | 'converted'
    | 'autoclosed_confirmed'
    | 'autoclosed_refuted'
    | 'sent_for_investigation',
): AlertStatus {
  switch (status) {
    case 'new':
      return 'NEW';
    case 'investigating':
      return 'INVESTIGATING';
    case 'closed':
      return 'CLOSED';
    case 'converted':
      return 'CONVERTED';
    case 'autoclosed_confirmed':
      return 'AUTOCLOSED_CONFIRMED';
    case 'autoclosed_refuted':
      return 'AUTOCLOSED_REFUTED';
    case 'sent_for_investigation':
      return 'SENT_FOR_INVESTIGATION';
    default:
      return 'NEW';
  }
}

/**
 * Extract transaction ID from transaction object
 */
function extractTransactionId(transaction: any): string | undefined {
  if (!transaction) return undefined;

  // Try common transaction ID fields
  return (
    transaction.transactionId ||
    transaction.txnId ||
    transaction.id ||
    transaction.TxId ||
    undefined
  );
}

/**
 * Extract amount from transaction object
 */
function extractAmount(transaction: any): number | undefined {
  if (!transaction) return undefined;

  // Try common amount fields
  const amount =
    transaction.amount ||
    transaction.AmtRaw ||
    transaction.TxAmt ||
    transaction.value;

  return typeof amount === 'number' ? amount : undefined;
}

/**
 * Extract currency from transaction object
 */
function extractCurrency(transaction: any): string | undefined {
  if (!transaction) return undefined;

  // Try common currency fields
  return (
    transaction.currency ||
    transaction.ccy ||
    transaction.CcyCode ||
    transaction.currencyCode ||
    'USD'
  ); // Default fallback
}

/**
 * Transform array of backend alerts to UI alerts
 */
export function transformBackendAlertsToUI(
  backendAlerts: TriageAlert[],
): UIAlert[] {
  return backendAlerts.map(transformBackendAlertToUI);
}
