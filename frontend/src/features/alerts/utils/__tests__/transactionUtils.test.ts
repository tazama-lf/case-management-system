import { describe, it, expect, vi } from 'vitest';
import {
  extractTransactionMessagesFromAlert,
  extractTransactionIdFromAlert,
} from '../transactionUtils';
import type { TransactionMessage } from '../../types/alertsdashboard.types';

describe('transactionUtils', () => {
  describe('extractTransactionMessagesFromAlert', () => {
    it('returns empty array for null or undefined transaction data', () => {
      expect(extractTransactionMessagesFromAlert(null, 'txn-1')).toEqual([]);
      expect(extractTransactionMessagesFromAlert(undefined, 'txn-1')).toEqual(
        [],
      );
    });

    it('returns empty array for non-object transaction data', () => {
      expect(extractTransactionMessagesFromAlert('string', 'txn-1')).toEqual(
        [],
      );
      expect(extractTransactionMessagesFromAlert(123, 'txn-1')).toEqual([]);
      // Note: Arrays are objects in JavaScript, so [] would pass the typeof check
      // but the function checks for specific properties, so empty array returns generic message
    });

    it('extracts FIToFIPmtSts message', () => {
      const transactionData = {
        FIToFIPmtSts: {
          GrpHdr: { MsgId: 'msg-1' },
        },
      };
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-1',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-txn-1-status',
        type: 'pacs.002.001.12',
        description: 'Payment Status Report',
        status: 'received',
      });
      expect(messages[0].timestamp).toBeDefined();
    });

    it('extracts FIToFICstmrCdt message', () => {
      const transactionData = {
        FIToFICstmrCdt: {
          GrpHdr: { MsgId: 'msg-2' },
        },
      };
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-2',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-txn-2-credit',
        type: 'pacs.008.001.10',
        description: 'Customer Credit Transfer Initiation',
        status: 'sent',
      });
      expect(messages[0].timestamp).toBeDefined();
    });

    it('extracts CstmrPmtStsRpt message', () => {
      const transactionData = {
        CstmrPmtStsRpt: {
          GrpHdr: { MsgId: 'msg-3' },
        },
      };
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-3',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-txn-3-cust-status',
        type: 'pain.002.001.12',
        description: 'Customer Payment Status Report',
        status: 'received',
      });
      expect(messages[0].timestamp).toBeDefined();
    });

    it('extracts multiple messages when all types are present', () => {
      const transactionData = {
        FIToFIPmtSts: { GrpHdr: { MsgId: 'msg-1' } },
        FIToFICstmrCdt: { GrpHdr: { MsgId: 'msg-2' } },
        CstmrPmtStsRpt: { GrpHdr: { MsgId: 'msg-3' } },
      };
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-4',
      );
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.type)).toEqual([
        'pacs.002.001.12',
        'pacs.008.001.10',
        'pain.002.001.12',
      ]);
    });

    it('returns generic message when no specific message types are found', () => {
      const transactionData = { someOtherField: 'value' };
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-5',
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-txn-5-generic',
        type: 'generic.transaction.data',
        description: 'Transaction Data',
        status: 'received',
      });
    });

    it('handles errors gracefully and returns empty array', () => {
      // Create an object that will throw when accessed
      const transactionData = {};
      Object.defineProperty(transactionData, 'FIToFIPmtSts', {
        get() {
          throw new Error('Access error');
        },
      });

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const messages = extractTransactionMessagesFromAlert(
        transactionData,
        'txn-6',
      );
      expect(messages).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('extractTransactionIdFromAlert', () => {
    it('extracts transaction ID from FIToFIPmtSts', () => {
      const alert = {
        transaction: {
          FIToFIPmtSts: {
            GrpHdr: { MsgId: 'txn-123' },
          },
        },
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('txn-123');
    });

    it('extracts transaction ID from FIToFICstmrCdt', () => {
      const alert = {
        transaction: {
          FIToFICstmrCdt: {
            GrpHdr: { MsgId: 'txn-456' },
          },
        },
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('txn-456');
    });

    it('falls back to txtp property', () => {
      const alert = {
        txtp: 'txn-789',
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('txn-789');
    });

    it('falls back to alert_id', () => {
      const alert = {
        alert_id: 'alert-123',
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('alert-123');
    });

    it('returns "Unknown" when no transaction ID is found', () => {
      const alert = {};
      expect(extractTransactionIdFromAlert(alert)).toBe('Unknown');
    });

    it('prioritizes FIToFIPmtSts over FIToFICstmrCdt', () => {
      const alert = {
        transaction: {
          FIToFIPmtSts: {
            GrpHdr: { MsgId: 'txn-first' },
          },
          FIToFICstmrCdt: {
            GrpHdr: { MsgId: 'txn-second' },
          },
        },
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('txn-first');
    });

    it('handles errors gracefully and returns fallback', () => {
      const alert = {
        transaction: {
          FIToFIPmtSts: {
            GrpHdr: {
              get MsgId() {
                throw new Error('Access error');
              },
            },
          },
        },
        txtp: 'fallback-txn',
      };

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const result = extractTransactionIdFromAlert(alert);
      expect(result).toBe('fallback-txn');
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('handles missing transaction property', () => {
      const alert = {
        txtp: 'txn-from-txtp',
        alert_id: 'alert-123',
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('txn-from-txtp');
    });

    it('handles nested null/undefined values', () => {
      const alert = {
        transaction: {
          FIToFIPmtSts: null,
          FIToFICstmrCdt: undefined,
        },
        alert_id: 'alert-456',
      };
      expect(extractTransactionIdFromAlert(alert)).toBe('alert-456');
    });
  });
});
