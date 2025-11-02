import type { TransactionMessage } from '../types/alertsdashboard.types';


export function extractTransactionMessagesFromAlert(
  transactionData: any,
  transactionId: string
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
        timestamp: new Date().toISOString(),
      });
    }

    if (transactionData.FIToFICstmrCdt) {
      messages.push({
        id: `msg-${transactionId}-credit`,
        type: 'pacs.008.001.10',
        description: 'Customer Credit Transfer Initiation',
        status: 'sent',
        timestamp: new Date(Date.now() - 60000).toISOString(),
      });
    }

    if (transactionData.CstmrPmtStsRpt) {
      messages.push({
        id: `msg-${transactionId}-cust-status`,
        type: 'pain.002.001.12',
        description: 'Customer Payment Status Report',
        status: 'received',
        timestamp: new Date(Date.now() - 30000).toISOString(),
      });
    }

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


export function extractTransactionIdFromAlert(alert: any): string {
  try {
    if (alert.transaction?.FIToFIPmtSts?.GrpHdr?.MsgId) {
      return alert.transaction.FIToFIPmtSts.GrpHdr.MsgId;
    }

    if (alert.transaction?.FIToFICstmrCdt?.GrpHdr?.MsgId) {
      return alert.transaction.FIToFICstmrCdt.GrpHdr.MsgId;
    }

    if (alert.txtp) {
      return alert.txtp;
    }

    return alert.alert_id || 'Unknown';
  } catch (error) {
    console.warn('Failed to extract transaction ID from alert:', error);
    return alert.txtp || alert.alert_id || 'Unknown';
  }
}
