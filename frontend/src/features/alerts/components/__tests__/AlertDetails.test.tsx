import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AlertDetails } from '../AlertDetails';
import type { Alert, ActionHistory } from '../../types/triage.types';


const baseAlert: Alert = {
  alert_id: 1,
  tenant_id: 'tenant-1',
  alert_type: 'FRAUD',
  source: 'System A',
  priority: 'URGENT',
  message: 'Suspicious transaction detected',
  confidence_per: 72,
  created_at: '2024-01-01T00:00:00Z',
  case_id: 100,
  alert_data: { foo: 'bar' },
  transaction: { amount: 100 },
  network_map: { nodes: [] },
};

const history: ActionHistory[] = [
  {
    audit_log_id: 1,
    operation: 'CREATE',
    action_performed: 'Alert created',
    outcome: 'SUCCESS',
    user_id: 'system',
    performed_at: '2024-01-01T00:00:00Z',
    entity_name: 'Alert',
  },
];

/* ================================================================== */
/*  Root                                                               */
/* ================================================================== */

describe('AlertDetails.Root', () => {
  it('renders children when alert is provided', () => {
    render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()}>
        <div>child content</div>
      </AlertDetails.Root>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('renders children when loading (no alert)', () => {
    render(
      <AlertDetails.Root alert={null} isLoading onClose={vi.fn()}>
        <div>loading child</div>
      </AlertDetails.Root>,
    );
    expect(screen.getByText('loading child')).toBeInTheDocument();
  });

  it('returns null when alert is null and not loading', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading={false} onClose={vi.fn()}>
        <div>should not render</div>
      </AlertDetails.Root>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('applies custom className', () => {
    const { container } = render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()} className="test-cls">
        <div />
      </AlertDetails.Root>,
    );
    expect(container.firstElementChild?.className).toContain('test-cls');
  });
});

/* ================================================================== */
/*  Header                                                             */
/* ================================================================== */

describe('AlertDetails.Header', () => {
  const renderHeader = (alertOverrides: Partial<Alert> = {}, props: { showCloseButton?: boolean } = {}) => {
    const onClose = vi.fn();
    const result = render(
      <AlertDetails.Root alert={{ ...baseAlert, ...alertOverrides }} onClose={onClose}>
        <AlertDetails.Header {...props} />
      </AlertDetails.Root>,
    );
    return { ...result, onClose };
  };

  it('renders title, priority badge, alert id', () => {
    renderHeader();
    expect(screen.getByText('Alert Details')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders close button by default and calls onClose', async () => {
    const { onClose } = renderHeader();
    const btn = screen.getByRole('button', { name: /close alert details/i });
    await userEvent.setup().click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it('hides close button when showCloseButton=false', () => {
    renderHeader({}, { showCloseButton: false });
    expect(screen.queryByRole('button', { name: /close alert details/i })).not.toBeInTheDocument();
  });

  it('returns null when alert is null (not loading)', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading={false} onClose={vi.fn()}>
        <AlertDetails.Header />
      </AlertDetails.Root>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows loading placeholders when isLoading', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading onClose={vi.fn()}>
        <AlertDetails.Header />
      </AlertDetails.Root>,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  /* --- getPriorityColor branches --- */
  it.each([
    ['BREACH', 'text-red-600'],
    ['CRITICAL', 'text-red-600'],
    ['URGENT', 'text-orange-600'],
    ['NEW', 'text-blue-600'],
    ['UNKNOWN', 'text-gray-600'],
  ])('applies correct color for priority %s', (priority, expectedClass) => {
    renderHeader({ priority: priority as Alert['priority'] });
    const badge = screen.getByText(priority);
    expect(badge.className).toContain(expectedClass);
  });
});

/* ================================================================== */
/*  Content                                                            */
/* ================================================================== */

describe('AlertDetails.Content', () => {
  const renderContent = (
    alertOverrides: Partial<Alert> = {},
    sections?: Array<'basic' | 'message' | 'data' | 'transaction' | 'network'>,
  ) =>
    render(
      <AlertDetails.Root alert={{ ...baseAlert, ...alertOverrides }} onClose={vi.fn()}>
        <AlertDetails.Content sections={sections} />
      </AlertDetails.Root>,
    );

  it('renders all sections by default', () => {
    renderContent();
    expect(screen.getAllByText('FRAUD').length).toBeGreaterThanOrEqual(1); // alert_type shown in badge + text
    expect(screen.getByText('System A')).toBeInTheDocument(); // source
    expect(screen.getByText('72%')).toBeInTheDocument(); // confidence
    expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
    expect(screen.getByText('Alert Data')).toBeInTheDocument();
    expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    expect(screen.getByText('Network Map')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // case_id
  });

  it('renders only selected sections', () => {
    renderContent({}, ['message']);
    expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
    expect(screen.queryByText('Alert Data')).not.toBeInTheDocument();
    expect(screen.queryByText('Alert Type')).not.toBeInTheDocument();
  });

  it('shows loading placeholders when isLoading', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading onClose={vi.fn()}>
        <AlertDetails.Content />
      </AlertDetails.Root>,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('returns null when no alert and not loading', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading={false} onClose={vi.fn()}>
        <AlertDetails.Content />
      </AlertDetails.Root>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows N/A for missing optional fields', () => {
    renderContent({
      alert_type: null,
      source: undefined,
      confidence_per: undefined,
      case_id: undefined,
    });
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "No message available" when message is empty', () => {
    renderContent({ message: '' });
    expect(screen.getByText('No message available')).toBeInTheDocument();
  });

  it('does not render JSON sections when data is null/undefined', () => {
    renderContent({ alert_data: undefined, transaction: undefined, network_map: undefined });
    expect(screen.queryByText('Alert Data')).not.toBeInTheDocument();
    expect(screen.queryByText('Transaction Data')).not.toBeInTheDocument();
    expect(screen.queryByText('Network Map')).not.toBeInTheDocument();
  });

  it('formats date using toLocaleString', () => {
    renderContent({ created_at: '2024-06-15T10:30:00Z' });
    // Just check it renders without errors - locale-dependent
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('handles invalid date gracefully', () => {
    renderContent({ created_at: 'not-a-date' });
    // new Date('not-a-date').toLocaleString() returns 'Invalid Date' (doesn't throw)
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  Actions                                                            */
/* ================================================================== */

describe('AlertDetails.Actions', () => {
  it('renders both update and close buttons', async () => {
    const onUpdate = vi.fn();
    const onCloseAlert = vi.fn();
    const user = userEvent.setup();

    render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()} onUpdate={onUpdate} onCloseAlert={onCloseAlert}>
        <AlertDetails.Actions />
      </AlertDetails.Root>,
    );

    await user.click(screen.getByRole('button', { name: /update alert/i }));
    await user.click(screen.getByRole('button', { name: /close alert/i }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ alert_id: 1 }));
    expect(onCloseAlert).toHaveBeenCalledWith(expect.objectContaining({ alert_id: 1 }));
  });

  it('renders only update button when actions=["update"]', () => {
    render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()} onUpdate={vi.fn()}>
        <AlertDetails.Actions actions={['update']} />
      </AlertDetails.Root>,
    );
    expect(screen.getByRole('button', { name: /update alert/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
  });

  it('renders only close button when actions=["close"]', () => {
    render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()} onCloseAlert={vi.fn()}>
        <AlertDetails.Actions actions={['close']} />
      </AlertDetails.Root>,
    );
    expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
  });

  it('returns null when no callbacks are provided', () => {
    const { container } = render(
      <AlertDetails.Root alert={baseAlert} onClose={vi.fn()}>
        <AlertDetails.Actions />
      </AlertDetails.Root>,
    );
    // Only the Root wrapper div should exist, no action buttons
    expect(screen.queryByRole('button', { name: /update alert/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
  });

  it('returns null when alert is null', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading={false} onClose={vi.fn()} onUpdate={vi.fn()}>
        <AlertDetails.Actions />
      </AlertDetails.Root>,
    );
    expect(container.innerHTML).toBe('');
  });
});

/* ================================================================== */
/*  History                                                            */
/* ================================================================== */

describe('AlertDetails.History', () => {
  it('renders action history items', () => {
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={history} onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(screen.getByText('Action History')).toBeInTheDocument();
    expect(screen.getByText(/CREATE/)).toBeInTheDocument();
    expect(screen.getByText(/Alert created/)).toBeInTheDocument();
    expect(screen.getByText(/SUCCESS/)).toBeInTheDocument();
    expect(screen.getByText(/User: system/)).toBeInTheDocument();
  });

  it('shows "No action history available" when empty', () => {
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={[]} onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(screen.getByText('No action history available')).toBeInTheDocument();
  });

  it('shows loading placeholders when isLoading', () => {
    const { container } = render(
      <AlertDetails.Root alert={null} isLoading onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.getByText('Action History')).toBeInTheDocument();
  });

  it('limits displayed items based on maxItems', () => {
    const manyActions: ActionHistory[] = Array.from({ length: 15 }, (_, i) => ({
      audit_log_id: i,
      operation: `OP_${i}`,
      action_performed: `action ${i}`,
      outcome: 'SUCCESS',
      user_id: `user-${i}`,
      performed_at: '2024-01-01T00:00:00Z',
      entity_name: 'Alert',
    }));

    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={manyActions} onClose={vi.fn()}>
        <AlertDetails.History maxItems={5} />
      </AlertDetails.Root>,
    );

    // Only first 5 items shown
    expect(screen.getByText(/OP_0/)).toBeInTheDocument();
    expect(screen.getByText(/OP_4/)).toBeInTheDocument();
    expect(screen.queryByText(/OP_5/)).not.toBeInTheDocument();
  });

  it('shows "View all N actions" button when items exceed maxItems', () => {
    const manyActions: ActionHistory[] = Array.from({ length: 15 }, (_, i) => ({
      audit_log_id: i,
      operation: `OP_${i}`,
      action_performed: `action ${i}`,
      outcome: 'SUCCESS',
      user_id: `user-${i}`,
      performed_at: '2024-01-01T00:00:00Z',
      entity_name: 'Alert',
    }));

    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={manyActions} onClose={vi.fn()}>
        <AlertDetails.History maxItems={5} />
      </AlertDetails.Root>,
    );

    expect(screen.getByText(/View all 15 actions/)).toBeInTheDocument();
  });

  it('does not show "View all" when items fit within maxItems', () => {
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={history} onClose={vi.fn()}>
        <AlertDetails.History maxItems={10} />
      </AlertDetails.Root>,
    );
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('renders action without action_performed text', () => {
    const historyNoPerformed: ActionHistory[] = [
      { ...history[0], action_performed: '' },
    ];
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={historyNoPerformed} onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(screen.getByText('CREATE')).toBeInTheDocument();
  });

  it('renders action without user_id', () => {
    const historyNoUser: ActionHistory[] = [
      { ...history[0], user_id: '' },
    ];
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={historyNoUser} onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(screen.queryByText(/User:/)).not.toBeInTheDocument();
  });

  it('renders action without outcome', () => {
    const historyNoOutcome: ActionHistory[] = [
      { ...history[0], outcome: '' },
    ];
    render(
      <AlertDetails.Root alert={baseAlert} actionHistory={historyNoOutcome} onClose={vi.fn()}>
        <AlertDetails.History />
      </AlertDetails.Root>,
    );
    expect(screen.getByText(/CREATE/)).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  Integration - full compound component                              */
/* ================================================================== */

describe('AlertDetails (integration)', () => {
  it('renders full alert details and triggers actions', async () => {
    const onClose = vi.fn();
    const onUpdate = vi.fn();
    const onCloseAlert = vi.fn();
    const user = userEvent.setup();

    render(
      <AlertDetails.Root
        alert={baseAlert}
        onClose={onClose}
        onUpdate={onUpdate}
        onCloseAlert={onCloseAlert}
        actionHistory={history}
      >
        <AlertDetails.Header />
        <AlertDetails.Content />
        <AlertDetails.Actions actions={['update', 'close']} />
        <AlertDetails.History />
      </AlertDetails.Root>,
    );

    expect(screen.getByText(/Alert Details/i)).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    expect(screen.getByText(/Suspicious transaction detected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Update Alert$/i }));
    await user.click(screen.getByRole('button', { name: /^Close Alert$/i }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ alert_id: 1 }));
    expect(onCloseAlert).toHaveBeenCalledWith(expect.objectContaining({ alert_id: 1 }));
  });
});
