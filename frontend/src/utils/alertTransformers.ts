import type { Alert as TriageAlert, Priority, AlertStatus } from '../types/triage.types';
import type { Alert as UIAlert } from '../types/alertsdashboard.types';

/**
 * Transform backend Alert to UI Alert format
 */
export function transformBackendAlertToUI(backendAlert: TriageAlert): UIAlert {
  return {
    ...backendAlert,
    // Map backend fields to UI fields
    id: backendAlert.alert_id,
    transactionId: extractTransactionId(backendAlert.transaction),
    title: backendAlert.message,
    description: backendAlert.message,
    type: backendAlert.alert_type || backendAlert.source || 'Unknown',
    severity: mapPriorityToSeverity(backendAlert.priority),
    riskScore: backendAlert.confidence_per,
    confidence: backendAlert.confidence_per,
    status: mapAlertStatusToUIStatus(backendAlert.alert_status),
    createdAt: backendAlert.created_at,
    updatedAt: backendAlert.created_at, // Backend doesn't have updated_at for alerts
    lastUpdated: backendAlert.created_at,
    // TODO: These will need to be added to backend schema or derived from other data
    assignedTo: undefined,
    assignee: undefined,
    amount: extractAmount(backendAlert.transaction),
    currency: extractCurrency(backendAlert.transaction),
  };
}

/**
 * Transform UI Alert back to backend Alert format
 */
export function transformUIAlertToBackend(uiAlert: UIAlert): TriageAlert {
  return {
    alert_id: uiAlert.alert_id,
    tenant_id: uiAlert.tenant_id,
    priority: uiAlert.priority,
    alert_type: uiAlert.alert_type as any, // Type assertion needed for compatibility
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
function mapPriorityToSeverity(priority: Priority): 'low' | 'medium' | 'high' | 'critical' {
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
export function mapSeverityToPriority(severity: 'low' | 'medium' | 'high' | 'critical'): Priority {
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
function mapAlertStatusToUIStatus(status: AlertStatus): 'new' | 'investigating' | 'resolved' | 'false_positive' | 'converted' {
  switch (status) {
    case 'NEW':
      return 'new';
    case 'INVESTIGATING':
      return 'investigating';
    case 'CLOSED':
      return 'resolved'; // Map CLOSED to resolved for UI
    case 'CONVERTED':
      return 'converted';
    default:
      return 'new';
  }
}

/**
 * Map UI status back to AlertStatus enum
 */
export function mapUIStatusToAlertStatus(status: 'new' | 'investigating' | 'resolved' | 'false_positive' | 'converted'): AlertStatus {
  switch (status) {
    case 'new':
      return 'NEW';
    case 'investigating':
      return 'INVESTIGATING';
    case 'resolved':
    case 'false_positive':
      return 'CLOSED'; // Map both resolved and false_positive to CLOSED
    case 'converted':
      return 'CONVERTED';
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
  return transaction.transactionId || 
         transaction.txnId || 
         transaction.id || 
         transaction.TxId ||
         undefined;
}

/**
 * Extract amount from transaction object
 */
function extractAmount(transaction: any): number | undefined {
  if (!transaction) return undefined;
  
  // Try common amount fields
  const amount = transaction.amount || 
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
  return transaction.currency || 
         transaction.ccy || 
         transaction.CcyCode ||
         transaction.currencyCode ||
         'USD'; // Default fallback
}

/**
 * Transform array of backend alerts to UI alerts
 */
export function transformBackendAlertsToUI(backendAlerts: TriageAlert[]): UIAlert[] {
  return backendAlerts.map(transformBackendAlertToUI);
}
