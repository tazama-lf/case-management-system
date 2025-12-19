import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationSummaryTab from '../InvestigationSummaryTab';
import { caseService } from '../../../services/caseService';
import { evidenceService } from '../../../services/evidenceService';
import { commentService } from '../../../services/commentService';
import { taskService } from '../../../services/taskService';
import userService from '../../../services/userService';
import GenerateInvestigationReportModal from '../../modals/GenerateInvestigationReportModal';

vi.mock('../../../services/caseService');
vi.mock('../../../services/evidenceService');
vi.mock('../../../services/commentService');
vi.mock('../../../services/taskService');
vi.mock('../../../services/userService');
vi.mock('../../modals/GenerateInvestigationReportModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="report-modal">Report Modal</div> : null,
}));

describe('InvestigationSummaryTab', () => {
  const mockCase = {
    case_id: 'CASE-123',
    case_type: 'FRAUD',
    status: 'STATUS_82_CLOSED_CONFIRMED',
    priority: 'HIGH',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  };

  const mockEvidence = {
    evidence: [
      {
        id: 'EVIDENCE-1',
        fileName: 'test.pdf',
        evidenceType: 'SANCTIONS',
        fileSize: 1024,
        uploadedAt: '2023-01-01T00:00:00Z',
      },
    ],
    total: 1,
  };

  const mockComments = [
    {
      comment_id: '1',
      note: 'Investigation complete',
      created_at: '2023-01-02T00:00:00Z',
      user_id: 'user-1',
    },
  ];

  const mockTasks = [
    {
      task_id: 'TASK-1',
      name: 'Approve Case Closure',
    },
    {
      task_id: 'TASK-2',
      name: 'Investigate Case',
      investigationNotes: 'Investigation notes here',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue(mockEvidence);
    (commentService.getCommentsByCase as vi.Mock).mockResolvedValue(mockComments);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([]);
    (userService.getUserDetailsById as vi.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
    });
    (userService.formatUserName as vi.Mock).mockReturnValue('John Doe');
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<InvestigationSummaryTab caseId="CASE-123" />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case details after loading', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
      const fraudTexts = screen.getAllByText('FRAUD');
      expect(fraudTexts.length).toBeGreaterThan(0);
    });
  });

  it('fetches case details, evidence, and comments on mount', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith('CASE-123');
      expect(evidenceService.getCaseEvidence).toHaveBeenCalledWith('CASE-123');
      expect(commentService.getCommentsByCase).toHaveBeenCalledWith('CASE-123');
    });
  });

  it('displays recommended outcome', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Recommended Outcome')).toBeInTheDocument();
      expect(screen.getByText(/Confirmed Fraud/i)).toBeInTheDocument();
    });
  });

  it('displays investigation notes when available', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
      expect(screen.getByText('Investigation notes here')).toBeInTheDocument();
    });
  });

  it('displays final investigation summary from comments', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Final Investigation Summary')).toBeInTheDocument();
      expect(screen.getByText('Investigation complete')).toBeInTheDocument();
    });
  });

  it('displays evidence summary with categories', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
      expect(screen.getByText(/Sanctions Screening Results/i)).toBeInTheDocument();
    });
  });

  it('opens report modal when generate report button is clicked', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('Generate Report');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
  });

  it('allows expanding evidence categories', async () => {
    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening Results/i)).toBeInTheDocument();
    });

    const categoryButton = screen.getByText(/Sanctions Screening Results/i).closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    }
  });

  it('allows expanding evidence categories to see download button', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.downloadEvidence as vi.Mock).mockResolvedValue(mockBlob);
    
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();

    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening Results/i)).toBeInTheDocument();
    });

    const categoryButton = screen.getByText(/Sanctions Screening Results/i).closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);
      
      await waitFor(() => {
        // After expanding, download button should be available
        const downloadButtons = screen.queryAllByText('Download');
        expect(downloadButtons.length).toBeGreaterThan(0);
      });
    }
  });

  it('displays empty state when no evidence', async () => {
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
      total: 0,
    });
    (commentService.getCommentsByCase as vi.Mock).mockResolvedValue([]);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);

    render(<InvestigationSummaryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No evidence uploaded yet/i)).toBeInTheDocument();
    });
  });
});

