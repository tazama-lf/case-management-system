import { describe, it, expect, vi } from 'vitest';

// Mock React Router to prevent initialization issues
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(() => ({ pathname: '/' })),
  Link: vi.fn(({ children }) => children),
  NavLink: vi.fn(({ children }) => children),
  Outlet: vi.fn(() => null),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(),
  QueryClientProvider: vi.fn(({ children }) => children),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

// Mock API client and storage utilities first
vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/shared/utils/storage', () => ({
  resetData: vi.fn(),
  getData: vi.fn(),
  setData: vi.fn(),
}));

// Mock shared providers
vi.mock('@/shared/providers/NotificationProvider', () => ({
  NotificationProvider: vi.fn(({ children }) => children),
  useNotifications: vi.fn(() => ({
    notifications: [],
    addNotification: vi.fn(),
  })),
}));

vi.mock('@/shared/providers/QueryProvider', () => ({
  QueryProvider: vi.fn(({ children }) => children),
}));

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
  }, 10000);

  it('exports AlertsSearchAndFilters', async () => {
    const mod = await import('../index');
    expect(mod.AlertsSearchAndFilters).toBeDefined();
  }, 10000);
});
