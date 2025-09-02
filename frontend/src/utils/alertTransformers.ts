import type {
  Alert as TriageAlert,
  Priority,
  AlertStatus,
} from '../types/triage.types';
import type { Alert as UIAlert } from '../types/alertsdashboard.types';

/**
 * Extract alert type from available data sources
 */
function extractAlertType(backendAlert: unknown): string | null {
  const alert = backendAlert as any;
  // First check if alert_type is directly available
  if (alert.alert_type) {
    return alert.alert_type;
  }
  
  // If alert_type is explicitly null, return null
  if (alert.alert_type === null) {
    return null;
  }
  
  // Try to derive from typology information
  try {
    const typologyResults = alert.alert_data?.tadpResult?.typologyResult;
    if (Array.isArray(typologyResults) && typologyResults.length > 0) {
      const typologyId = typologyResults[0]?.id;
      if (typologyId && typeof typologyId === 'string') {
        // Extract meaningful part from typology ID like "typology-processor@1.0.0"
        if (typologyId.includes('typology')) return 'AML_SCREENING';
        if (typologyId.includes('fraud')) return 'FRAUD_DETECTION';
        if (typologyId.includes('sanction')) return 'SANCTIONS_SCREENING';
      }
    }
  } catch (error) {
    console.warn('Failed to extract alert type from typology data:', error);
  }
  
  // Fallback to transaction type or default
  const txType = alert.txtp;
  if (txType) {
    if (txType.includes('pacs')) return 'TRANSACTION_MONITORING';
    if (txType.includes('pain')) return 'TRANSACTION_MONITORING';
  }
  
  return 'TRANSACTION_MONITORING'; // Default fallback
}

/**
 * Extract risk score from alert_data.tadpResult.typologyResult
 */
function extractRiskScore(alertData: unknown): number {
  try {
    const data = alertData as any;
    const typologyResults = data?.tadpResult?.typologyResult;
    if (Array.isArray(typologyResults) && typologyResults.length > 0) {
      // Get the first typology result's score
      const result = typologyResults[0]?.result;
      return typeof result === 'number' ? result : 0;
    }
    return 0;
  } catch (error) {
    console.warn('Failed to extract risk score from alert data:', error);
    return 0;
  }
}

/**
 * Transform backend Alert to UI Alert format
 */
export function transformBackendAlertToUI(backendAlert: TriageAlert): UIAlert {
  const transformedAlert: UIAlert = {
    // Backend fields
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

    // UI-specific mapped fields
    id: backendAlert.alert_id,
    transactionId: extractTransactionId(backendAlert.transaction),
    title: backendAlert.message,
    description: backendAlert.message,
    type: extractAlertType(backendAlert) || 'Unknown',
    severity: mapPriorityToSeverity(backendAlert.priority),
    riskScore: extractRiskScore(backendAlert.alert_data) || backendAlert.confidence_per || 0,
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

/**
 * Map Priority enum to UI severity string
 */
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

/**
 * Map UI severity back to Priority enum
 */
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

/**
 * Transform UI Alert back to backend format
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
    confidence_per: uiAlert.confidence_per,
    created_at: uiAlert.created_at,
    case_id: uiAlert.case_id,
  };
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
function extractTransactionId(transaction: unknown): string | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;
  
  const txn = transaction as any;
  return (
    txn.transactionId ||
    txn.txnId ||
    txn.id ||
    txn.TxId ||
    undefined
  );
}

/**
 * Extract amount from transaction object
 */
function extractAmount(transaction: unknown): number | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;
  
  const txn = transaction as any;
  const amount =
    txn.amount ||
    txn.AmtRaw ||
    txn.TxAmt ||
    txn.value;

  return typeof amount === 'number' ? amount : parseFloat(amount) || undefined;
}

/**
 * Extract currency from transaction object
 */
function extractCurrency(transaction: unknown): string | undefined {
  if (!transaction || typeof transaction !== 'object') return undefined;

  const txn = transaction as any;
  // Try common currency fields
  return (
    txn.currency ||
    txn.ccy ||
    txn.CcyCode ||
    txn.currencyCode ||
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
