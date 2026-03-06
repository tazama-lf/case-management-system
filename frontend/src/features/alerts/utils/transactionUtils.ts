import { formatDate } from '@/shared/utils/dateUtils';
import type { TransactionMessage } from '../types/alertsdashboard.types';
import type { Alert } from '../types/triage.types';

export function extractTransactionMessagesFromAlert(
  transactionData: Record<string, unknown>,
  transactionId: string,
): TransactionMessage[] {
  const messages: TransactionMessage[] = [];

  try {
    if (transactionData.FIToFIPmtSts) {
      messages.push({
        id: `msg-${transactionId}-status`,
        type: 'pacs.002.001.12',
        description: 'Payment Status Report',
        status: 'received',
        timestamp: formatDate(new Date().toISOString()),
      });
    }

    if (transactionData.FIToFICstmrCdt) {
      messages.push({
        id: `msg-${transactionId}-credit`,
        type: 'pacs.008.001.10',
        description: 'Customer Credit Transfer Initiation',
        status: 'sent',
        timestamp: formatDate(new Date(Date.now() - 60000).toISOString()),
      });
    }

    if (transactionData.CstmrPmtStsRpt) {
      messages.push({
        id: `msg-${transactionId}-cust-status`,
        type: 'pain.002.001.12',
        description: 'Customer Payment Status Report',
        status: 'received',
        timestamp: formatDate(new Date(Date.now() - 30000).toISOString()),
      });
    }

    if (messages.length === 0) {
      messages.push({
        id: `msg-${transactionId}-generic`,
        type: 'generic.transaction.data',
        description: 'Transaction Data',
        status: 'received',
        timestamp: formatDate(new Date().toISOString()),
      });
    }

    return messages;
  } catch (error) {
    console.warn(
      'Failed to extract transaction messages from alert data:',
      error,
    );
    return [];
  }
}

export function extractTransactionIdFromAlert(alert: Alert): string {
  try {
    const transaction = alert.transaction as Record<string, unknown> | undefined;
    const fiToFIPmtSts = transaction?.FIToFIPmtSts as Record<string, unknown> | undefined;
    const fiToFICstmrCdt = transaction?.FIToFICstmrCdt as Record<string, unknown> | undefined;
    
    if (fiToFIPmtSts?.GrpHdr) {
      const grpHdr = fiToFIPmtSts.GrpHdr as Record<string, unknown>;
      if (grpHdr.MsgId) {
        return typeof grpHdr.MsgId === 'string' ? grpHdr.MsgId : JSON.stringify(grpHdr.MsgId);
      }
    }

    if (fiToFICstmrCdt?.GrpHdr) {
      const grpHdr = fiToFICstmrCdt.GrpHdr as Record<string, unknown>;
      if (grpHdr.MsgId) {
        return typeof grpHdr.MsgId === 'string' ? grpHdr.MsgId : JSON.stringify(grpHdr.MsgId);
      }
    }

    if (alert.txtp) {
      return alert.txtp;
    }

    return String(alert.alert_id);
  } catch (error) {
    console.warn('Failed to extract transaction ID from alert:', error);
    return alert.txtp ?? String(alert.alert_id);
  }
}
