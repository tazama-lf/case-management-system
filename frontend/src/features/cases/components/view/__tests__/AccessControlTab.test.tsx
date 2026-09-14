import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessControlTab from '../AccessControlTab';
import { investigatorService } from '@/features/cases/services/investigatorService';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';
import type { CaseInvestigator } from '@/features/cases/types/investigator.types';

// This tab is only ever rendered for a supervisor+ caller — ViewCaseModal
// doesn't include it in the tab list otherwise (plan §2/§6). So there's no
// role branching to test here, unlike an earlier draft of this component;
// every whitelist row always shows Revoke/Blacklist, every blacklist row
// always shows Unblock, and there is no add form of any kind.

vi.mock('@/features/cases/services/investigatorService');
vi.mock('@/features/cases/hooks/useInvestigatorSupervisorList');

const LEAD_USER_ID = 'user-lead';
const OBSERVER_USER_ID = 'user-observer';

const mockWhitelist: CaseInvestigator[] = [
  {
    id: 1,
    case_id: 42,
    user_id: LEAD_USER_ID,
    membership: 'LEAD',
    granted_by: 'user-supervisor',
    granted_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
  },
  {
    id: 2,
    case_id: 42,
    user_id: OBSERVER_USER_ID,
    membership: 'OBSERVER',
    granted_by: 'user-supervisor',
    granted_at: '2026-01-02T00:00:00Z',
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
  },
];

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccessControlTab caseId={42} />
    </QueryClientProvider>,
  );
}

async function waitForWhitelistLoaded() {
  // "Tier" only renders once the whitelist table has actually loaded.
  await screen.findByRole('columnheader', { name: 'Tier' });
}

describe('AccessControlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useInvestigatorSupervisorList as unknown as vi.Mock).mockReturnValue({
      investigators: [],
      supervisors: [],
      complianceOfficers: [],
      fetchInvestigatorsList: vi.fn(),
      fetchSupervisorsList: vi.fn(),
      fetchComplianceOfficersList: vi.fn(),
      getAssigneeFullName: (id?: string) => {
        const map: Record<string, string> = {
          [LEAD_USER_ID]: 'Lee Adley',
          [OBSERVER_USER_ID]: 'Obi Server',
          'user-supervisor': 'Sam Visor',
        };
        return map[id ?? ''] ?? 'N/A';
      },
      clearCache: vi.fn(),
    });

    (investigatorService.getCaseInvestigators as vi.Mock).mockResolvedValue(
      mockWhitelist,
    );
    (investigatorService.getCaseBlacklist as vi.Mock).mockResolvedValue([]);
  });

  it('renders the whitelist with names, tiers, and always shows Revoke/Blacklist actions', async () => {
    renderTab();
    await waitForWhitelistLoaded();

    expect(screen.getByText('Lee Adley')).toBeInTheDocument();
    expect(screen.getByText('Obi Server')).toBeInTheDocument();
    expect(screen.getByText('LEAD')).toBeInTheDocument();
    expect(screen.getByText('OBSERVER')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Revoke/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Blacklist/ })).toHaveLength(
      2,
    );
  });

  it('has no add-investigator form of any kind', async () => {
    renderTab();
    await waitForWhitelistLoaded();

    expect(screen.queryByLabelText('Add investigator')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add' }),
    ).not.toBeInTheDocument();
    // Confirms the service is never even asked to add — it has no such method.
    expect(
      (investigatorService as unknown as Record<string, unknown>)
        .addInvestigator,
    ).toBeUndefined();
  });

  it('shows an empty state when nobody is on the case', async () => {
    (investigatorService.getCaseInvestigators as vi.Mock).mockResolvedValue([]);

    renderTab();

    await waitFor(() => {
      expect(
        screen.getByText('No investigators on this case yet'),
      ).toBeInTheDocument();
    });
  });

  it('shows an error state with retry when the whitelist fails to load', async () => {
    (investigatorService.getCaseInvestigators as vi.Mock).mockRejectedValue(
      new Error('network error'),
    );

    renderTab();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load investigators'),
      ).toBeInTheDocument();
    });
  });

  it('revokes an investigator with a mandatory reason', async () => {
    const user = userEvent.setup();
    (investigatorService.revokeInvestigator as vi.Mock).mockResolvedValue(
      undefined,
    );

    renderTab();
    await waitForWhitelistLoaded();

    const [firstRevoke] = screen.getAllByRole('button', { name: /Revoke/ });
    await user.click(firstRevoke);

    expect(
      screen.getByRole('heading', { name: 'Revoke Access' }),
    ).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', {
      name: 'Revoke Access',
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Reason for revocation/),
      'No longer needed on this case',
    );
    await user.click(confirmButton);

    await waitFor(() => {
      expect(investigatorService.revokeInvestigator).toHaveBeenCalledWith(
        42,
        LEAD_USER_ID,
        'No longer needed on this case',
      );
    });
  });

  it('blacklists an investigator with a mandatory reason', async () => {
    const user = userEvent.setup();
    (investigatorService.blacklistInvestigator as vi.Mock).mockResolvedValue(
      {},
    );

    renderTab();
    await waitForWhitelistLoaded();

    const [firstBlacklist] = screen.getAllByRole('button', {
      name: /Blacklist/,
    });
    await user.click(firstBlacklist);

    await user.type(
      screen.getByLabelText(/Reason for blacklisting/),
      'Conflict of interest',
    );

    // Both the row actions and the modal's confirm button can be named
    // "Blacklist" — the confirm button is the modal's, rendered last.
    const blacklistButtons = screen.getAllByRole('button', {
      name: 'Blacklist',
    });
    await user.click(blacklistButtons[blacklistButtons.length - 1]);

    await waitFor(() => {
      expect(investigatorService.blacklistInvestigator).toHaveBeenCalledWith(
        42,
        { userId: LEAD_USER_ID, reason: 'Conflict of interest' },
      );
    });
  });

  it('renders the blacklist and unblocks with a mandatory reason', async () => {
    const user = userEvent.setup();
    (investigatorService.getCaseBlacklist as vi.Mock).mockResolvedValue([
      {
        id: 1,
        case_id: 42,
        user_id: 'user-blocked',
        blocked_by: 'user-supervisor',
        blocked_at: '2026-01-05T00:00:00Z',
        block_reason: 'Conflict of interest',
        unblocked_at: null,
        unblocked_by: null,
        unblock_reason: null,
      },
    ]);
    (investigatorService.unblockInvestigator as vi.Mock).mockResolvedValue(
      undefined,
    );

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Conflict of interest')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Unblock/ }));
    await user.type(
      screen.getByLabelText(/Reason for unblocking/),
      'Investigation cleared them',
    );

    // Both the row action and the modal's confirm button are labeled
    // "Unblock" — the confirm button is the modal's, rendered last in the
    // DOM (after the whitelist/blacklist sections).
    const unblockButtons = screen.getAllByRole('button', { name: 'Unblock' });
    await user.click(unblockButtons[unblockButtons.length - 1]);

    await waitFor(() => {
      expect(investigatorService.unblockInvestigator).toHaveBeenCalledWith(
        42,
        'user-blocked',
        'Investigation cleared them',
      );
    });
  });

  it('shows an empty state when nobody is blacklisted', async () => {
    renderTab();

    await waitFor(() => {
      expect(
        screen.getByText('Nobody is blacklisted on this case'),
      ).toBeInTheDocument();
    });
  });
});
