import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedItemsTab from '../LinkedItemsTab';
import { caseService } from '../../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';

vi.mock('../../../services/caseService');
vi.mock('@/features/alerts/services/triageservice');
vi.mock('@/features/alerts/components/AlertsDetailModal', () => ({
  default: () => <div data-testid="alerts-detail-modal" />,
}));

describe('LinkedItemsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(
      () => new Promise(() => { }),
    );
    render(<LinkedItemsTab caseId={123} />);
    // Loading spinner is present but doesn't have role="status"
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays related items after loading', async () => {
    const mockCase = {
      case_id: 123,
      case_type: 'FRAUD',
      parent_id: null,
      alert: { alert_id: 1 },
    };
    const mockAlert = {
      alert_id: 1,
      message: 'Test Alert',
      alert_type: 'FRAUD',
    };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);

    render(<LinkedItemsTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Related Items')).toBeInTheDocument();
    });
  });

  it('displays no related alerts message when none found', async () => {
    const mockCase = {
      case_id: 123,
      case_type: 'FRAUD',
      parent_id: null,
      alert: null,
    };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);

    render(<LinkedItemsTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('No related alerts found')).toBeInTheDocument();
    });
  });

  it('fetches case details on mount', async () => {
    const mockCase = {
      case_id: 123,
      case_type: 'FRAUD',
      parent_id: null,
      alert: { alert_id: 1 },
    };
    const mockAlert = {
      alert_id: 1,
      message: 'Test Alert',
      alert_type: 'FRAUD',
    };

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);

    render(<LinkedItemsTab caseId={123} />);

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith(123);
      expect(triageService.getAlertById).toHaveBeenCalledWith(1);
    });
  });
});
