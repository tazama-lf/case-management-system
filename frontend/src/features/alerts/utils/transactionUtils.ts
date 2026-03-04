import { formatDate } from '@/shared/utils/dateUtils';
import type { TransactionMessage } from '../types/alertsdashboard.types';

export function extractTransactionMessagesFromAlert(
  transactionData: unknown,
  transactionId: string,
): TransactionMessage[] {
  if (!transactionData || typeof transactionData !== 'object') {
    return [];
  }

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

interface AlertWithTransaction {
  transaction?: {
    FIToFIPmtSts?: { GrpHdr?: { MsgId?: string } };
    FIToFICstmrCdt?: { GrpHdr?: { MsgId?: string } };
  };
  txtp?: string;
  alert_id?: string | number;
}

export function extractTransactionIdFromAlert(alert: unknown): string {
  const a = alert as AlertWithTransaction;
  try {
    if (a.transaction?.FIToFIPmtSts?.GrpHdr?.MsgId) {
      return a.transaction.FIToFIPmtSts.GrpHdr.MsgId;
    }

    if (a.transaction?.FIToFICstmrCdt?.GrpHdr?.MsgId) {
      return a.transaction.FIToFICstmrCdt.GrpHdr.MsgId;
    }

    if (a.txtp) {
      return a.txtp;
    }

    return String(a.alert_id ?? 'Unknown');
  } catch (error) {
    console.warn('Failed to extract transaction ID from alert:', error);
    return String(a.txtp ?? a.alert_id ?? 'Unknown');
  }
}
