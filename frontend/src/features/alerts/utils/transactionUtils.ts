import type { TransactionMessage } from '../types/alertsdashboard.types';

/**
 * Extracts transaction messages from alert transaction data
 * This eliminates the need for a separate transaction messages API endpoint
 */
export function extractTransactionMessagesFromAlert(
  transactionData: any,
  transactionId: string
): TransactionMessage[] {
  if (!transactionData || typeof transactionData !== 'object') {
    return [];
  }

  const messages: TransactionMessage[] = [];

  try {
    // Look for ISO 20022 message structure
    if (transactionData.FIToFIPmtSts) {
      // pacs.002.001.12 - Payment Status Report
      messages.push({
        id: `msg-${transactionId}-status`,
        type: 'pacs.002.001.12',
        description: 'Payment Status Report',
        status: 'received',
        timestamp: new Date().toISOString(),
      });
    }

    if (transactionData.FIToFICstmrCdt) {
      // pacs.008.001.10 - Customer Credit Transfer Initiation
      messages.push({
        id: `msg-${transactionId}-credit`,
        type: 'pacs.008.001.10',
        description: 'Customer Credit Transfer Initiation',
        status: 'sent',
        timestamp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      });
    }

    // Look for any other message types in the transaction data
    if (transactionData.CstmrPmtStsRpt) {
      // pain.002.001.12 - Customer Payment Status Report
      messages.push({
        id: `msg-${transactionId}-cust-status`,
        type: 'pain.002.001.12',
        description: 'Customer Payment Status Report',
        status: 'received',
        timestamp: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      });
    }

    // If no specific ISO 20022 messages found, create a generic transaction message
    if (messages.length === 0) {
      messages.push({
        id: `msg-${transactionId}-generic`,
        type: 'generic.transaction.data',
        description: 'Transaction Data',
        status: 'received',
        timestamp: new Date().toISOString(),
      });
    }

    return messages;
  } catch (error) {
    console.warn('Failed to extract transaction messages from alert data:', error);
    return [];
  }
}

/**
 * Extracts transaction ID from alert data
 * This function looks for the transaction ID in various places in the alert structure
 */
export function extractTransactionIdFromAlert(alert: any): string {
  try {
    // Check transaction object for ISO 20022 message ID
    if (alert.transaction?.FIToFIPmtSts?.GrpHdr?.MsgId) {
      return alert.transaction.FIToFIPmtSts.GrpHdr.MsgId;
    }

    if (alert.transaction?.FIToFICstmrCdt?.GrpHdr?.MsgId) {
      return alert.transaction.FIToFICstmrCdt.GrpHdr.MsgId;
    }

    // Fallback to txtp field
    if (alert.txtp) {
      return alert.txtp;
    }

    // Last resort - use alert ID
    return alert.alert_id || 'Unknown';
  } catch (error) {
    console.warn('Failed to extract transaction ID from alert:', error);
    return alert.txtp || alert.alert_id || 'Unknown';
  }
}
