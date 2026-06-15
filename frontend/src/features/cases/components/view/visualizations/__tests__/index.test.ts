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

import * as VisualizationsExports from '../index';

describe('visualizations index barrel exports', () => {
  it('exports AlertNavigatorTab', () => {
    expect(VisualizationsExports.AlertNavigatorTab).toBeDefined();
  });

  it('exports alertNavigatorService', () => {
    expect(VisualizationsExports.alertNavigatorService).toBeDefined();
  });

  it('exports AlertHistoryTab', () => {
    expect(VisualizationsExports.AlertHistoryTab).toBeDefined();
  });

  it('exports ConditionsTab', () => {
    expect(VisualizationsExports.ConditionsTab).toBeDefined();
  });

  it('exports TransactionDetailsTab', () => {
    expect(VisualizationsExports.TransactionDetailsTab).toBeDefined();
  });

  it('exports TransactionHistoryTab', () => {
    expect(VisualizationsExports.TransactionHistoryTab).toBeDefined();
  });

  it('exports NetworkAnalysisTab', () => {
    expect(VisualizationsExports.NetworkAnalysisTab).toBeDefined();
  });
});
