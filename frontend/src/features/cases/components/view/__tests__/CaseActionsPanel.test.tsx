import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CaseActionsPanel from '../CaseActionsPanel';

vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1', username: 'testuser' }),
  },
}));

const mockHasComplianceOfficerRole = vi.fn(() => false);
const mockHasSupervisorRole = vi.fn(() => false);

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
    hasSupervisorRole: mockHasSupervisorRole,
  }),
}));

vi.mock('../../../services/caseService', () => ({
  caseService: {
    getCaseDetails: vi.fn().mockResolvedValue({
      case_owner_user_id: 'user-1',
      status: 'STATUS_20_IN_PROGRESS',
    }),
  },
}));

vi.mock('../../../hooks/useCaseTasks', () => ({
  useCaseTasks: () => ({
    tasks: [],
    fetchTasks: vi.fn().mockResolvedValue([]),
  }),
}));

describe('CaseActionsPanel', () => {
  const defaultProps = {
    caseData: {
      id: 1,
      status: 'STATUS_20_IN_PROGRESS',
      action: 'None',
      tasks: [],
    } as any,
    subCasesDetails: undefined,
    parentCaseDetails: null,
    canManageSupervisorActions: false,
  };

  it('renders without crashing', () => {
    const { container } = render(<CaseActionsPanel {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('returns null for compliance officer', () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const { container } = render(<CaseActionsPanel {...defaultProps} />);
    expect(container.innerHTML).toBe('');
    mockHasComplianceOfficerRole.mockReturnValue(false);
  });
});
