import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedItemsTab from '../LinkedItemsTab';
import { caseService } from '../../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';

vi.mock('../../../services/caseService');
vi.mock('@/features/alerts/services/triageservice');

describe('LinkedItemsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<LinkedItemsTab caseId="CASE-123" />);
    // Loading spinner is present but doesn't have role="status"
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays related items after loading', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      parent_id: null,
    };
    const mockAlerts = {
      alerts: [
        {
          alert_id: 'ALERT-1',
          case_id: 'CASE-123',
          message: 'Test Alert',
          alert_type: 'FRAUD',
          transaction: { TransactionID: 'TXN-1' },
        },
      ],
    };
    const mockCases = {
      cases: [mockCase],
    };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlerts as vi.Mock).mockResolvedValue(mockAlerts);
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockCases);

    render(<LinkedItemsTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Related Items')).toBeInTheDocument();
    });
  });

  it('displays no related cases message when none found', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      parent_id: null,
    };
    const mockAlerts = { alerts: [] };
    const mockCases = { cases: [mockCase] };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlerts as vi.Mock).mockResolvedValue(mockAlerts);
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockCases);

    render(<LinkedItemsTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('No related cases found')).toBeInTheDocument();
    });
  });

  it('fetches case details and alerts on mount', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      parent_id: null,
    };
    const mockAlerts = { alerts: [] };
    const mockCases = { cases: [mockCase] };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlerts as vi.Mock).mockResolvedValue(mockAlerts);
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockCases);

    render(<LinkedItemsTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith('CASE-123');
      expect(triageService.getAlerts).toHaveBeenCalled();
    });
  });
});

