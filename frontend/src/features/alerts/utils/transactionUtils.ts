import { formatDate } from '@/shared/utils/dateUtils';
import type { TransactionMessage } from '../types/alertsdashboard.types';

export function extractTransactionMessagesFromAlert(
  transactionData: Record<string, unknown>,
  transactionId: string,
): TransactionMessage[] {

  const messages: TransactionMessage[] = [];

  try {
    if ('FIToFIPmtSts' in transactionData) {
      messages.push({
        id: `msg-${transactionId}-status`,
        type: 'pacs.002.001.12',
        description: 'Payment Status Report',
        status: 'received',
        timestamp: formatDate(new Date().toISOString()),
      });
    }

    if ('FIToFICstmrCdt' in transactionData) {
      messages.push({
        id: `msg-${transactionId}-credit`,
        type: 'pacs.008.001.10',
        description: 'Customer Credit Transfer Initiation',
        status: 'sent',
        timestamp: formatDate(new Date(Date.now() - 60000).toISOString()),
      });
    }

    if ('CstmrPmtStsRpt' in transactionData) {
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

export function extractTransactionIdFromAlert(
  alert: Record<string, unknown>,
): string {
  try {
    const transaction = alert.transaction as
      | Record<string, unknown>
      | undefined;

    if (transaction && typeof transaction === 'object') {
      const fiToFIPmtSts = transaction.FIToFIPmtSts as
        | Record<string, unknown>
        | undefined;
      if (fiToFIPmtSts && typeof fiToFIPmtSts === 'object') {
        const grpHdr = fiToFIPmtSts.GrpHdr as
          | Record<string, unknown>
          | undefined;
        if (grpHdr?.MsgId) {
          return grpHdr.MsgId as string;
        }
      }

      const fiToFICstmrCdt = transaction.FIToFICstmrCdt as
        | Record<string, unknown>
        | undefined;
      if (fiToFICstmrCdt && typeof fiToFICstmrCdt === 'object') {
        const grpHdr = fiToFICstmrCdt.GrpHdr as
          | Record<string, unknown>
          | undefined;
        if (grpHdr?.MsgId) {
          return grpHdr.MsgId as string;
        }
      }
    }

    if (alert.txtp) {
      return alert.txtp as string;
    }

    return (alert.alert_id ?? 'Unknown') as string;
  } catch (error) {
    console.warn('Failed to extract transaction ID from alert:', error);
    return (alert.txtp ?? alert.alert_id ?? 'Unknown') as string;
  }
}

