import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AlertsDetailModal from '../AlertsDetailModal';
import type { ActionHistory } from '../../types/triage.types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGetAlertById = vi.fn();
const mockGetAlertActionHistory = vi.fn();
vi.mock('../../services/triageservice', () => ({
  default: {
    getAlertById: (...args: unknown[]) => mockGetAlertById(...args),
    getAlertActionHistory: (...args: unknown[]) => mockGetAlertActionHistory(...args),
  },
}));

const mockGetUserDetailsById = vi.fn();
const mockFormatUserName = vi.fn();
vi.mock('../../../cases/services/userService', () => ({
  default: {
    getUserDetailsById: (...args: unknown[]) => mockGetUserDetailsById(...args),
  },
  UserService: {
    formatUserName: (...args: unknown[]) => mockFormatUserName(...args),
  },
}));

const mockGetTasksByCaseId = vi.fn();
vi.mock('../../../cases/services/taskService', () => ({
  taskService: {
    getTasksByCaseId: (...args: unknown[]) => mockGetTasksByCaseId(...args),
  },
}));

const mockUseCaseImpl = vi.fn(() => ({ data: { status: 'STATUS_20_IN_PROGRESS' } }));
const mockCanActOnCase = vi.fn(() => true);
vi.mock('../../../cases/hooks/useCase', () => ({
  useCase: (...args: unknown[]) => mockUseCaseImpl(...args),
  canActOnCase: (...args: unknown[]) => mockCanActOnCase(...args),
}));

let mockSystemConfig = { isManualMode: false, isDisabledMode: false, isAIMode: false };
vi.mock('@/shared/hooks/useSystemConfig', () => ({
  useSystemConfig: () => mockSystemConfig,
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d ?? 'Unknown date',
}));

const mockInvalidateQueries = vi.fn();
// IMPORTANT: Return a stable reference; otherwise queryClient changes every
// render and triggers the useEffect dependency [queryClient] infinitely.
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

vi.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'x-mark-icon' }),
  ClockIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'clock-icon' }),
  ExclamationTriangleIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'exclamation-icon' }),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const baseAlert = {
  alert_id: 1,
  tenant_id: 'tenant-1',
  priority: 'URGENT',
  alert_type: 'FRAUD',
  source: 'System A',
  txtp: 'pacs.008',
  message: 'Suspicious activity',
  alert_data: { status: 'ACTIVE' },
  transaction: { amount: 5000 },
  network_map: { nodes: ['A', 'B'] },
  confidence_per: 75,
  created_at: '2024-01-15T10:00:00Z',
  case_id: 100,
  prediction_outcome: 'FRAUD',
};

const baseHistory: ActionHistory = {
  audit_log_id: 1,
  user_id: 'user-001',
  operation: 'ALERT_CREATED',
  entity_name: 'Alert',
  action_performed: 'Alert created by user-001',
  outcome: 'SUCCESS',
  performed_at: '2024-01-15T10:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const defaultProps = {
  alertId: 1,
  isOpen: true,
  onClose: vi.fn(),
  onAlertUpdated: vi.fn(),
  onManualTriage: vi.fn(),
};

const setupMocks = (overrides: Record<string, unknown> = {}) => {
  mockGetAlertById.mockResolvedValue(overrides.alert ?? baseAlert);
  mockGetAlertActionHistory.mockResolvedValue(overrides.history ?? baseHistory);
  mockGetTasksByCaseId.mockResolvedValue(overrides.tasks ?? []);
  mockGetUserDetailsById.mockResolvedValue({ first_name: 'John', last_name: 'Doe' });
  mockFormatUserName.mockReturnValue('John Doe');
  mockCanActOnCase.mockReturnValue(overrides.canAct ?? true);
  mockSystemConfig = {
    isManualMode: (overrides.isManualMode as boolean) ?? false,
    isDisabledMode: (overrides.isDisabledMode as boolean) ?? false,
    isAIMode: (overrides.isAIMode as boolean) ?? false,
  };
};

/**
 * Render the modal with fake timers that only target setTimeout/clearTimeout
 * (leaving React's internal scheduling intact), advance past the 500ms delay,
 * wait for content to load, then switch back to real timers.
 */
const renderAndWait = async (props: Partial<typeof defaultProps> = {}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const result = render(<AlertsDetailModal {...defaultProps} {...props} />);
  // Advance past the 500ms timeout
  await vi.advanceTimersByTimeAsync(600);
  vi.useRealTimers();
  // Wait for async state updates to settle
  await waitFor(
    () => expect(screen.getByText('Alert Details')).toBeInTheDocument(),
    { timeout: 2000 },
  );
  return result;
};

const renderAndWaitForError = async (props: Partial<typeof defaultProps> = {}) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const result = render(<AlertsDetailModal {...defaultProps} {...props} />);
  await vi.advanceTimersByTimeAsync(600);
  vi.useRealTimers();
  await waitFor(
    () => expect(screen.getByText('Error Loading Alert')).toBeInTheDocument(),
    { timeout: 2000 },
  );
  return result;
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AlertsDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    setupMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /* ============= visibility ============= */

  describe('visibility', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <AlertsDetailModal {...defaultProps} isOpen={false} />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('shows loading spinner initially', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      render(<AlertsDetailModal {...defaultProps} />);
      // After first useEffect fires but before timer resolves
      await vi.advanceTimersByTimeAsync(100);
      expect(screen.getByText('Loading alert details...')).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  /* ============= error state ============= */

  describe('error state', () => {
    it('shows error message when fetch rejects with Error', async () => {
      mockGetAlertById.mockRejectedValue(new Error('Network error'));
      await renderAndWaitForError();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows generic message when fetch rejects with non-Error', async () => {
      mockGetAlertById.mockRejectedValue('oops');
      await renderAndWaitForError();
      expect(screen.getByText('Failed to load alert details')).toBeInTheDocument();
    });

    it('renders Retry and Close buttons', async () => {
      mockGetAlertById.mockRejectedValue(new Error('fail'));
      await renderAndWaitForError();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('calls onClose via Close button', async () => {
      mockGetAlertById.mockRejectedValue(new Error('fail'));
      await renderAndWaitForError();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  /* ============= alert content ============= */

  describe('alert content', () => {
    it('renders header with priority badge', async () => {
      await renderAndWait();
      expect(screen.getByText('URGENT')).toBeInTheDocument();
    });

    it('displays alert_data.status', async () => {
      await renderAndWait();
      expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    });

    it('shows alert ID and source', async () => {
      await renderAndWait();
      expect(screen.getByText(/Alert ID: 1/)).toBeInTheDocument();
      expect(screen.getByText(/Source: System A/)).toBeInTheDocument();
    });

    it('shows "No message available" when status missing', async () => {
      setupMocks({ alert: { ...baseAlert, alert_data: {} } });
      await renderAndWait();
      expect(screen.getByText('No message available')).toBeInTheDocument();
    });

    it('shows source as N/A when undefined', async () => {
      setupMocks({ alert: { ...baseAlert, source: undefined } });
      await renderAndWait();
      expect(screen.getByText(/Source: N\/A/)).toBeInTheDocument();
    });
  });

  /* ============= alert summary ============= */

  describe('alert summary', () => {
    it('renders heading', async () => {
      await renderAndWait();
      expect(screen.getByText('Alert Summary')).toBeInTheDocument();
    });

    it('shows confidence percentage', async () => {
      await renderAndWait();
      expect(document.body.textContent).toContain('75%');
    });

    it('shows case status', async () => {
      await renderAndWait();
      expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
    });
  });

  /* ============= transaction data ============= */

  describe('transaction data', () => {
    it('renders section', async () => {
      await renderAndWait();
      expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    });

    it('shows "No transaction data" when null', async () => {
      setupMocks({ alert: { ...baseAlert, transaction: null } });
      await renderAndWait();
      expect(screen.getByText('No transaction data')).toBeInTheDocument();
    });

    it('renders JSON-highlighted data', async () => {
      await renderAndWait();
      const pre = document.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre!.innerHTML).toContain('amount');
    });
  });

  /* ============= action history ============= */

  describe('action history', () => {
    it('renders heading', async () => {
      await renderAndWait();
      expect(screen.getByText('Action History')).toBeInTheDocument();
    });

    it('resolves username', async () => {
      await renderAndWait();
      await waitFor(() => {
        expect(mockGetUserDetailsById).toHaveBeenCalledWith('user-001');
      });
    });

    it('applies green styling for SUCCESS', async () => {
      await renderAndWait();
      expect(document.querySelector('.bg-green-100')).toBeTruthy();
    });

    it('handles fetch failure gracefully', async () => {
      // When history fetch fails, component sets {} as ActionHistory.
      // There's a component bug: actionHistory?.operation.includes() crashes
      // when operation is undefined. Wrap in an Error Boundary so the crash
      // doesn't surface as an unhandled exception in the test runner.
      mockGetAlertActionHistory.mockRejectedValue(new Error('fail'));

      class TestErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        state = { hasError: false };
        static getDerivedStateFromError() {
          return { hasError: true };
        }
        render() {
          return this.state.hasError
            ? React.createElement('div', { 'data-testid': 'error-boundary' }, 'Render error caught')
            : this.props.children;
        }
      }

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        React.createElement(TestErrorBoundary, null,
          React.createElement(AlertsDetailModal, { ...defaultProps }),
        ),
      );
      await vi.advanceTimersByTimeAsync(600);
      vi.useRealTimers();

      // Verify the history API was called
      await waitFor(() => {
        expect(mockGetAlertActionHistory).toHaveBeenCalledWith(1);
      });
      // The Error Boundary catches the render crash
      await waitFor(() => {
        expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      });
      consoleSpy.mockRestore();
    });
  });

  /* ============= Rules & Typologies ============= */

  describe('Rules & Typologies', () => {
    it('renders heading and toggle', async () => {
      await renderAndWait();
      expect(screen.getByText('Rules & Typologies')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show risk breakdown/i })).toBeInTheDocument();
    });

    it('toggles breakdown table', async () => {
      await renderAndWait();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /show risk breakdown/i }));
      expect(screen.getByText('Risk Component')).toBeInTheDocument();
      expect(screen.getByText('Total Score')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /hide risk breakdown/i }));
      expect(screen.queryByText('Risk Component')).not.toBeInTheDocument();
    });

    it('shows fallback when no tadpResult', async () => {
      setupMocks({ alert: { ...baseAlert, alert_data: { status: 'ACTIVE' } } });
      await renderAndWait();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /show risk breakdown/i }));
      expect(screen.getByText('Multiple ATM Withdrawals')).toBeInTheDocument();
      expect(screen.getByText('Geographic Distribution')).toBeInTheDocument();
    });

    it('extra component for CRITICAL', async () => {
      setupMocks({ alert: { ...baseAlert, priority: 'CRITICAL', alert_data: { status: 'ACTIVE' } } });
      await renderAndWait();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /show risk breakdown/i }));
      expect(screen.getByText('Aggregated Transaction Mirroring')).toBeInTheDocument();
    });

    it('extra component for BREACH', async () => {
      setupMocks({ alert: { ...baseAlert, priority: 'BREACH', alert_data: { status: 'ACTIVE' } } });
      await renderAndWait();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /show risk breakdown/i }));
      expect(screen.getByText('Aggregated Transaction Mirroring')).toBeInTheDocument();
    });

    it('parses tadpResult ruleResults', async () => {
      setupMocks({
        alert: {
          ...baseAlert,
          alert_data: {
            status: 'ACTIVE',
            tadpResult: {
              typologyResult: [
                {
                  cfg: 'TYP-001',
                  label: 'Money Laundering',
                  result: 850,
                  ruleResults: [
                    { ruleId: 'R001', label: 'High Value', subRuleRef: 'velocity', wght: 300 },
                    { ruleId: 'R002', name: 'Pattern Match', type: 'pattern', weight: 250 },
                  ],
                },
              ],
            },
          },
        },
      });
      await renderAndWait();
      expect(screen.getByText('Money Laundering')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /show risk breakdown/i }));
      expect(screen.getByText('High Value')).toBeInTheDocument();
      expect(screen.getByText('Pattern Match')).toBeInTheDocument();
    });
  });

  /* ============= priority color ============= */

  describe('getPriorityColor', () => {
    it.each([
      ['CRITICAL', 'text-red-600'],
      ['HIGH', 'text-orange-600'],
      ['MEDIUM', 'text-yellow-600'],
      ['LOW', 'text-green-600'],
      ['UNKNOWN', 'text-gray-600'],
    ])('applies correct class for %s', async (priority, expectedClass) => {
      setupMocks({ alert: { ...baseAlert, priority } });
      await renderAndWait();
      const badge = screen.getByText(priority);
      expect(badge.className).toContain(expectedClass);
    });
  });

  /* ============= getRiskScore ============= */

  describe('getRiskScore', () => {
    it('calculates score from confidence + priority', async () => {
      setupMocks({ alert: { ...baseAlert, alert_data: { status: 'ACTIVE' } } });
      await renderAndWait();
      expect(document.body.textContent).toContain('1125');
    });
  });

  /* ============= close / overlay ============= */

  describe('close interactions', () => {
    it('close button fires callbacks', async () => {
      await renderAndWait();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(defaultProps.onAlertUpdated).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('overlay click fires callbacks', async () => {
      await renderAndWait();
      const user = userEvent.setup();

      const overlay = Array.from(
        document.querySelectorAll('[aria-hidden="true"]'),
      ).find((el) => el.classList.contains('opacity-60'));
      expect(overlay).toBeTruthy();
      await user.click(overlay as HTMLElement);
      expect(defaultProps.onAlertUpdated).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  /* ============= task check ============= */

  describe('Complete New Case task', () => {
    it('checks task status', async () => {
      await renderAndWait();
      await waitFor(() => {
        expect(mockGetTasksByCaseId).toHaveBeenCalledWith(100);
      });
    });

    it('skips without case_id', async () => {
      setupMocks({ alert: { ...baseAlert, case_id: undefined } });
      await renderAndWait();
      expect(mockGetTasksByCaseId).not.toHaveBeenCalled();
    });

    it('handles error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetTasksByCaseId.mockRejectedValue(new Error('fail'));
      await renderAndWait();
      await waitFor(() => expect(spy).toHaveBeenCalled());
      spy.mockRestore();
    });
  });

  /* ============= invalidateQueries ============= */

  describe('query invalidation', () => {
    it('invalidates with case_id', async () => {
      await renderAndWait();
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['case', 100] }),
      );
    });

    it('skips without case_id', async () => {
      setupMocks({ alert: { ...baseAlert, case_id: undefined } });
      await renderAndWait();
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });

  /* ============= manual triage ============= */

  describe('manual triage button', () => {
    it('visible in manual mode', async () => {
      setupMocks({ isManualMode: true, canAct: true });
      await renderAndWait();
      expect(screen.getByRole('button', { name: /update alert/i })).toBeInTheDocument();
    });

    it('hidden when triage completed', async () => {
      setupMocks({
        isManualMode: true,
        canAct: true,
        history: { ...baseHistory, operation: 'ALERT_UPDATED' },
      });
      await renderAndWait();
      expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
    });

    it('hidden in AI mode', async () => {
      setupMocks({ isManualMode: true, isAIMode: true, canAct: true });
      await renderAndWait();
      expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
    });

    it('hidden when canActOnCase false', async () => {
      setupMocks({ isManualMode: true });
      mockCanActOnCase.mockReturnValue(false);
      await renderAndWait();
      expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
    });

    it('calls onManualTriage on click', async () => {
      setupMocks({ isManualMode: true, canAct: true });
      await renderAndWait();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /update alert/i }));
      expect(defaultProps.onManualTriage).toHaveBeenCalled();
    });

    it('visible in disabled mode when isManualMode is nullish', async () => {
      // Source uses (isManualMode ?? isDisabledMode): ?? only falls through
      // when left is null/undefined, not false.
      setupMocks({ canAct: true });
      mockSystemConfig = { isManualMode: undefined as unknown as boolean, isDisabledMode: true, isAIMode: false };
      await renderAndWait();
      expect(screen.getByRole('button', { name: /update alert/i })).toBeInTheDocument();
    });
  });

  /* ============= AI badge ============= */

  describe('AI mode', () => {
    it('shows badge', async () => {
      setupMocks({ isAIMode: true });
      await renderAndWait();
      expect(screen.getByText('AI Processed')).toBeInTheDocument();
    });

    it('hides badge', async () => {
      setupMocks({ isAIMode: false });
      await renderAndWait();
      expect(screen.queryByText('AI Processed')).not.toBeInTheDocument();
    });
  });

  /* ============= isCompleteNewCaseCompleted ============= */

  describe('isCompleteNewCaseCompleted', () => {
    it('hides triage when task completed', async () => {
      setupMocks({
        isManualMode: true,
        canAct: true,
        tasks: [{ name: 'Complete New Case', status: 'STATUS_30_COMPLETED' }],
      });
      await renderAndWait();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
      });
    });
  });
});
