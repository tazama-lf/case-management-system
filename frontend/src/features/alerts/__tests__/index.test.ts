import { describe, it, expect, vi } from 'vitest';
import CryptoJS from 'crypto-js';

// Mock the crypto module entirely
vi.mock('@/shared/utils/crypto', () => {
  const mockKey = 'test-secret-key-123';

  return {
    encrypt: (data: unknown): string => {
      const stringified = JSON.stringify(data);
      return CryptoJS.AES.encrypt(stringified, mockKey).toString();
    },
    decrypt: (encryptedData: string): unknown => {
      const bytes = CryptoJS.AES.decrypt(encryptedData, mockKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Failed to decrypt data');
      }
      return JSON.parse(decryptedString) as unknown;
    },
  };
});

import * as module from '../index';

describe('alerts/index.ts exports', () => {
  it('exports AlertDetails component', () => {
    expect(module.AlertDetails).toBeDefined();
  });

  it('exports AlertsDetailModal component', () => {
    expect(module.AlertsDetailModal).toBeDefined();
  });

  it('exports AlertsSearchAndFilters component', () => {
    expect(module.AlertsSearchAndFilters).toBeDefined();
  });

  it('exports AlertsTable component', () => {
    expect(module.AlertsTable).toBeDefined();
  });

  it('exports ManualTriageModal component', () => {
    expect(module.ManualTriageModal).toBeDefined();
  });

  it('exports TransactionMessagesModal component', () => {
    expect(module.TransactionMessagesModal).toBeDefined();
  });

  it('exports MessagePayloadModal component', () => {
    expect(module.MessagePayloadModal).toBeDefined();
  });

  it('exports hooks/services', () => {
    expect(module.useAlerts).toBeDefined();
    expect(module.useAlertsQuery).toBeDefined();
    expect(module.useAlertDetails).toBeDefined();
    expect(module.useAlertActionHistory).toBeDefined();
    expect(module.useAlertMutations).toBeDefined();
    expect(module.useAlertFilterOptions).toBeDefined();
    expect(module.alertsQueryKeys).toBeDefined();
    expect(module.useAlertOperations).toBeDefined();
    expect(module.triageService).toBeDefined();
  });

  it('exports AlertsDashboard page', () => {
    expect(module.AlertsDashboard).toBeDefined();
  });
});
