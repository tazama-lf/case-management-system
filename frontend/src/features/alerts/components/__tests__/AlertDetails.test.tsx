import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AlertDetails } from '../AlertDetails';

const baseAlert = {
  alert_id: 'ALERT-1',
  alert_type: 'FRAUD',
  source: 'System A',
  priority: 'URGENT',
  message: 'Suspicious transaction detected',
  confidence_per: 72,
  created_at: '2024-01-01T00:00:00Z',
  case_id: 'CASE-1',
  alert_data: { foo: 'bar' },
  transaction: { amount: 100 },
  network_map: { nodes: [] },
};

const history = [
  {
    audit_log_id: 'log-1',
    operation: 'CREATE',
    action_performed: 'Alert created',
    outcome: 'SUCCESS',
    user_id: 'system',
    performed_at: '2024-01-01T00:00:00Z',
  },
];

describe('AlertDetails', () => {
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
      >
        <AlertDetails.Header />
        <AlertDetails.Content />
        <AlertDetails.Actions actions={['update', 'close']} />
        <AlertDetails.History actionHistory={history} />
      </AlertDetails.Root>,
    );

    expect(screen.getByText(/Alert Details/i)).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    expect(
      screen.getByText(/Suspicious transaction detected/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Update Alert$/i }));
    await user.click(screen.getByRole('button', { name: /^Close Alert$/i }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ alert_id: 'ALERT-1' }),
    );
    expect(onCloseAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alert_id: 'ALERT-1' }),
    );
  });

  it('shows placeholders when loading, and renders nothing once alert is absent and not loading', () => {
    const { rerender, container } = render(
      <AlertDetails.Root alert={null} isLoading onClose={vi.fn()}>
        <AlertDetails.Header />
        <AlertDetails.Content />
        <AlertDetails.History />
      </AlertDetails.Root>,
    );

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    );

    rerender(
      <AlertDetails.Root alert={null} isLoading={false} onClose={vi.fn()}>
        <AlertDetails.Header />
      </AlertDetails.Root>,
    );

    expect(screen.queryByText(/Alert Details/i)).not.toBeInTheDocument();
  });
});

describe('AlertDetailsRoot', () => {
  it('renders without crashing', () => {
    render(
      <AlertDetails.Root
        alert={{ id: '1', title: 'Test Alert', status: 'open' }}
        onClose={() => {}}
      >
        <div>Test Alert</div>
      </AlertDetails.Root>,
    );
    expect(screen.getByText(/Test Alert/i)).toBeInTheDocument();
  });
});
