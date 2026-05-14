import { describe, it, expect, vi } from 'vitest';

// Mock the problematic service dependencies before importing components
vi.mock('../../../cases/services/filterService', () => ({
  filterService: {
    getFilters: vi.fn(),
    createFilter: vi.fn(),
  },
}));

vi.mock('../../../auth/services/authService', () => ({
  default: {
    getToken: vi.fn(),
    getUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}));

describe('alerts components barrel exports', () => {
  it('exports AlertsTable', async () => {
    const mod = await import('../index');
    expect(mod.AlertsTable).toBeDefined();
  });

  it('exports AlertsSearchAndFilters', async () => {
    const mod = await import('../index');
    expect(mod.AlertsSearchAndFilters).toBeDefined();
  });
});
