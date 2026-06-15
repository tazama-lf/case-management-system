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

describe('dashboard index barrel exports', () => {
  it('exports Dashboard', async () => {
    const mod = await import('../index');
    expect(mod.Dashboard).toBeDefined();
  });

  it('exports StatsCard', async () => {
    const mod = await import('../index');
    expect(mod.StatsCard).toBeDefined();
  });

  it('exports StatsCards', async () => {
    const mod = await import('../index');
    expect(mod.StatsCards).toBeDefined();
  });

  it('exports DashboardSection', async () => {
    const mod = await import('../index');
    expect(mod.DashboardSection).toBeDefined();
  });

  it('exports AlertSummaryItem', async () => {
    const mod = await import('../index');
    expect(mod.AlertSummaryItem).toBeDefined();
  });

  it('exports CaseSummaryItem', async () => {
    const mod = await import('../index');
    expect(mod.CaseSummaryItem).toBeDefined();
  });

  it('exports useDashboard hook', async () => {
    const mod = await import('../index');
    expect(mod.useDashboard).toBeDefined();
  });

  it('exports dashboardService', async () => {
    const mod = await import('../index');
    expect(mod.dashboardService).toBeDefined();
  });
});
