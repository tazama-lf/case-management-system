import type {
  Alert as TriageAlert,
  Priority,
  AlertStatus,
  AlertType,
} from '../types/triage.types';
import type { Alert as UIAlert } from '../types/alertsdashboard.types';

function extractAlertType(backendAlert: unknown): AlertType | null {
  const alert = backendAlert as any;
  if (alert.alert_type) {
    const validTypes = ['FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE'];
    if (validTypes.includes(alert.alert_type)) {
      return alert.alert_type as AlertType;
    }
  }

  if (alert.alert_type === null) {
    return null;
  }

  try {
    const typologyResults = alert.alert_data?.tadpResult?.typologyResult;
    if (Array.isArray(typologyResults) && typologyResults.length > 0) {
      const typologyId = typologyResults[0]?.id;
      if (typologyId && typeof typologyId === 'string') {
        if (typologyId.includes('typology')) return 'AML';
        if (typologyId.includes('fraud')) return 'FRAUD';
        if (typologyId.includes('sanction')) return 'AML';
      }
    }
  } catch (error) {
    console.warn('Failed to extract alert type from typology data:', error);
  }

  const txType = alert.txtp;
  if (txType) {
    if (txType.includes('pacs')) return 'FRAUD';
    if (txType.includes('pain')) return 'FRAUD';
  }

  return 'FRAUD';
}

function extractRiskScore(alertData: unknown): number {
  try {
    const data = alertData as any;
    const typologyResults = data?.tadpResult?.typologyResult;
    if (Array.isArray(typologyResults) && typologyResults.length > 0) {
      const result = typologyResults[0]?.result;
      return typeof result === 'number' ? result : 0;
    }
    return 0;
  } catch (error) {
    console.warn('Failed to extract risk score from alert data:', error);
    return 0;
  }
}

export function transformBackendAlertToUI(backendAlert: TriageAlert): UIAlert {
  const transformedAlert: UIAlert = {
    alert_id: backendAlert.alert_id,
    tenant_id: backendAlert.tenant_id || 'default-tenant',
    priority: backendAlert.priority,
    alert_type: extractAlertType(backendAlert) || undefined,
    source: backendAlert.source,
    txtp: backendAlert.txtp,
    message: backendAlert.message,
    alert_data: backendAlert.alert_data,
    transaction: backendAlert.transaction,
    network_map: backendAlert.network_map,
    confidence_per: backendAlert.confidence_per,
    created_at: backendAlert.created_at,
    case_id: backendAlert.case_id,

    id: backendAlert.alert_id,
    transactionId: extractTransactionId(backendAlert.transaction),
    title: backendAlert.message,
    description: backendAlert.message,
    type: extractAlertType(backendAlert) || 'Unknown',
    severity: mapPriorityToSeverity(backendAlert.priority),
    riskScore:
      extractRiskScore(backendAlert.alert_data) ||
      backendAlert.confidence_per ||
      0,
    confidence: backendAlert.confidence_per,
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

function mapPriorityToSeverity(
  priority: Priority,
): 'low' | 'medium' | 'high' | 'critical' {
  switch (priority) {
    case 'NEW':
      return 'low';
    case 'URGENT':
      return 'medium';
    case 'CRITICAL':
      return 'high';
    case 'BREACH':
      return 'critical';
    default:
      return 'medium';
  }
}

export function mapSeverityToPriority(
  severity: 'low' | 'medium' | 'high' | 'critical',
): Priority {
  switch (severity) {
    case 'low':
      return 'NEW';
    case 'medium':
      return 'URGENT';
    case 'high':
      return 'CRITICAL';
    case 'critical':
      return 'BREACH';
    default:
      return 'NEW';
  }
}

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
    confidence_per: uiAlert.confidence_per,
    created_at: uiAlert.created_at,
    case_id: uiAlert.case_id,
  };
}

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

function extractTransactionId(transaction: unknown): string | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;

  const txn = transaction as any;
  return txn.transactionId || txn.txnId || txn.id || txn.TxId || undefined;
}

function extractAmount(transaction: unknown): number | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;

  const txn = transaction as any;
  const amount = txn.amount || txn.AmtRaw || txn.TxAmt || txn.value;

  return typeof amount === 'number' ? amount : parseFloat(amount) || undefined;
}

function extractCurrency(transaction: unknown): string | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;

  const txn = transaction as any;
  return txn.currency || txn.ccy || txn.CcyCode || txn.currencyCode || 'USD';
}

export function transformBackendAlertsToUI(
  backendAlerts: TriageAlert[],
): UIAlert[] {
  return backendAlerts.map(transformBackendAlertToUI);
}
