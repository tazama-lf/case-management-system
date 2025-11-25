import type { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/**
 * Create a new QueryClient for testing with sensible defaults
 */
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that includes all common providers
 */
export const AllProviders = ({
  children,
  queryClient = createTestQueryClient(),
}: AllProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps components with all necessary providers
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: CustomRenderOptions,
) => {
  const { queryClient, ...renderOptions } = options || {};

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Mock data generators
 */
export const mockCase = (overrides = {}) => ({
  case_id: 'CASE-001',
  tenant_id: 'tenant-1',
  owner_id: 'user-1',
  case_status: 'STATUS_20_IN_PROGRESS',
  priority: 'HIGH',
  case_type: 'FRAUD',
  description: 'Test case description',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
  ...overrides,
});

export const mockAlert = (overrides = {}) => ({
  alert_id: 'ALERT-001',
  tenant_id: 'tenant-1',
  priority: 'CRITICAL',
  source: 'FRAUD',
  alert_type: 'FRAUD',
  message: 'Suspicious transaction detected',
  confidence_per: 85,
  created_at: '2024-01-15T10:00:00Z',
  ...overrides,
});

export const mockUser = (overrides = {}) => ({
  user_id: 'user-1',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'INVESTIGATOR',
  tenant_id: 'tenant-1',
  ...overrides,
});

/**
 * Wait for loading states to resolve
 */
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
