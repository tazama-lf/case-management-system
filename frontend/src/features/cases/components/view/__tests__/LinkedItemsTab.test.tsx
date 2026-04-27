import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedItemsTab from '../LinkedItemsTab';
import { caseService } from '../../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';

vi.mock('../../../services/caseService');
vi.mock('@/features/alerts/services/triageservice');
vi.mock('@/features/alerts/components/AlertsDetailModal', () => ({
  default: ({ isOpen, alertId, onClose }: any) =>
    isOpen ? (
      <div data-testid="alerts-detail-modal">
        Alert {alertId} <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe('LinkedItemsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<LinkedItemsTab caseId={123} />);
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

  it('opens alert modal when alert is clicked', async () => {
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
      expect(screen.getByText('1 - Test Alert')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('1 - Test Alert'));
    await waitFor(() => {
      expect(screen.getByTestId('alerts-detail-modal')).toBeInTheDocument();
    });
  });

  it('closes alert modal', async () => {
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
      expect(screen.getByText('1 - Test Alert')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('1 - Test Alert'));
    await waitFor(() => {
      expect(screen.getByTestId('alerts-detail-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('alerts-detail-modal'),
      ).not.toBeInTheDocument();
    });
  });

  it('handles parent case with alert', async () => {
    const childCase = {
      case_id: 123,
      parent_id: 100,
      alert: { alert_id: null },
    };
    const parentCase = {
      case_id: 100,
      parent_id: null,
      alert: { alert_id: 5 },
    };
    const mockAlert = {
      alert_id: 5,
      message: 'Parent Alert',
      alert_type: 'AML',
    };
    (caseService.getCaseDetails as vi.Mock).mockImplementation(
      async (id: number) => {
        if (id === 123) return childCase;
        return parentCase;
      },
    );
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    render(<LinkedItemsTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('5 - Parent Alert')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    (caseService.getCaseDetails as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    render(<LinkedItemsTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('No related alerts found')).toBeInTheDocument();
    });
  });

  it('displays alert label and id', async () => {
    const mockCase = { case_id: 123, parent_id: null, alert: { alert_id: 1 } };
    const mockAlert = {
      alert_id: 1,
      message: 'Suspicious Transaction',
      alert_type: 'FRAUD',
    };
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    render(<LinkedItemsTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText('1 - Suspicious Transaction'),
      ).toBeInTheDocument();
    });
  });
});
