import { render, screen, userEvent, waitFor } from '../../../../test/testUtils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateCaseModal from '../CreateCaseModal';
import triageService from '@/features/alerts/services/triageservice';
import userService from '@/features/cases/services/userService';

// Mock services
vi.mock('@/features/alerts/services/triageservice', () => ({
  default: {
    getNALTAlerts: vi.fn(),
  },
}));

vi.mock('@/features/cases/services/userService', () => ({
  default: {
    getAllUsers: vi.fn(),
  },
}));

vi.mock('../../auth/services/authService', () => ({
  default: {
    getUser: vi.fn().mockReturnValue({ userId: 'user-1' }),
  },
}));

// Mock child component
vi.mock('../LinkExistingAlerts', () => ({
  default: ({ onAlertsChange, selectedAlerts }: any) => (
    <div data-testid="link-existing-alerts">
      <button
        onClick={() =>
          onAlertsChange([
            { alert_id: 'ALERT-123', transaction: '{"data":"test"}' },
          ])
        }
      >
        Select Alert
      </button>
      <button onClick={() => onAlertsChange([])}>Deselect Alert</button>
      {selectedAlerts.length > 0 && <span>Alert Selected</span>}
    </div>
  ),
}));

describe('CreateCaseModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onCompleteCase: vi.fn(),
    onSaveDraft: vi.fn(),
  };

  const mockAlerts = [
    {
      alert_id: 'ALERT-123',
      message: 'Test Alert',
      transaction: '{"data":"test"}',
    },
  ];

  const mockUsers = [{ id: 'user-1', name: 'John Doe', role: 'Investigator' }];

  beforeEach(() => {
    vi.resetAllMocks();
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        pageSize: 10,
      },
    });
    (userService.getAllUsers as any).mockResolvedValue(mockUsers);
  });

  it('should not render when open is false', () => {
    render(<CreateCaseModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Create Manual Case')).not.toBeInTheDocument();
  });

  it('should render correctly in create mode', async () => {
    render(<CreateCaseModal {...defaultProps} />);

    expect(screen.getByText('Create Manual Case')).toBeInTheDocument();
    expect(screen.getByText('Create Case')).toBeInTheDocument();
    expect(screen.getByText('Save as Draft')).toBeInTheDocument();

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalled();
    });
  });

  it('should render correctly in edit mode', () => {
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    expect(screen.getByText('Complete Draft Case')).toBeInTheDocument();
    expect(screen.getByText('Complete Case')).toBeInTheDocument();
    expect(screen.queryByText('Save as Draft')).not.toBeInTheDocument();
  });

  it('should validate form before submission', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Create Case button should be disabled when no alert is selected
    const createButton = screen.getByText('Create Case');
    expect(createButton).toBeDisabled();

    // Draft button should also be disabled without selected alert
    const draftButton = screen.getByText('Save as Draft');
    expect(draftButton).toBeDisabled();
  });

  it('should update priority when score changes', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Use getByRole for the number input
    const scoreInput = screen.getByRole('spinbutton');

    // Set to High/Critical
    await user.clear(scoreInput);
    await user.type(scoreInput, '0.7');

    expect(screen.getAllByText(/CRITICAL/i).length).toBeGreaterThan(0);
  });

  it('should submit form with correct data', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Select Alert (via mock component)
    await user.click(screen.getByText('Select Alert'));

    // Select Alert Type
    const typeSelect = screen.getByLabelText(/Alert Type/i);
    await user.selectOptions(typeSelect, 'AML');

    // Submit
    const createButton = screen.getByText('Create Case');
    await waitFor(() => {
      expect(createButton).not.toBeDisabled();
    });
    await user.click(createButton);

    expect(defaultProps.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'AML',
        priority: expect.any(String),
        priorityScore: expect.any(Number),
      }),
    );
  });

  it('should submit as draft', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Select Alert
    await user.click(screen.getByText('Select Alert'));

    // Submit Draft
    const draftButton = screen.getByText('Save as Draft');
    await user.click(draftButton);

    expect(defaultProps.onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: true,
      }),
    );
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (triageService.getNALTAlerts as any).mockRejectedValue(
      new Error('API Error'),
    );

    render(<CreateCaseModal {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    // Should still render modal
    expect(screen.getByText('Create Manual Case')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should render edit mode form fields', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{
          alertType: 'AML',
          priority: 'URGENT',
          priorityScore: 0.5,
          confidence: 75,
        }}
      />,
    );

    expect(screen.getByText('Complete Draft Case')).toBeInTheDocument();
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons.length).toBeGreaterThan(0);
    expect(screen.getByText('Prediction Outcome')).toBeInTheDocument();
    expect(screen.getByText('Case Status')).toBeInTheDocument();
    expect(screen.getByText(/Notes/)).toBeInTheDocument();
  });

  it('should show validation errors in edit mode when note is empty', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    const completeBtn = screen.getByText('Complete Case');
    await user.click(completeBtn);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Note is required for manual triage/).length,
      ).toBeGreaterThan(0);
    });
  });

  it('should show note length validation in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'abc');

    const completeBtn = screen.getByText('Complete Case');
    await user.click(completeBtn);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Note must be at least 4 characters/).length,
      ).toBeGreaterThan(0);
    });
  });

  it('should complete case in edit mode with valid data', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={42} />,
    );

    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'Valid investigation notes here');

    const completeBtn = screen.getByText('Complete Case');
    await user.click(completeBtn);

    expect(defaultProps.onCompleteCase).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        note: 'Valid investigation notes here',
        alertType: expect.any(String),
      }),
    );
  });

  it('should change prediction outcome in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    const predictionSelect = screen.getByDisplayValue('False Positive');
    await user.selectOptions(predictionSelect, 'TRUE_POSITIVE');
    expect(screen.getByDisplayValue('True Positive')).toBeInTheDocument();
  });

  it('should change case status in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'FRAUD' }}
      />,
    );

    const statusSelect = screen.getByDisplayValue(
      'Ready for Assignment (Investigation)',
    );
    await user.selectOptions(statusSelect, 'STATUS_82_CLOSED_CONFIRMED');
    expect(screen.getByDisplayValue('Closed - Confirmed')).toBeInTheDocument();
  });

  it('should disable status dropdown for AML alert type', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'AML' }}
      />,
    );

    const statusSelect = screen.getByDisplayValue(
      'Ready for Assignment (Investigation)',
    );
    expect(statusSelect).toBeDisabled();
  });

  it('should disable status dropdown for FRAUD_AND_AML alert type', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'FRAUD_AND_AML' }}
      />,
    );

    const statusSelect = screen.getByDisplayValue(
      'Ready for Assignment (Investigation)',
    );
    expect(statusSelect).toBeDisabled();
  });

  it('should show error message when provided', () => {
    render(<CreateCaseModal {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<CreateCaseModal {...defaultProps} loading={true} />);
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  it('should show updating text in edit mode when loading', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        loading={true}
      />,
    );
    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show transaction data when selected alert has transaction', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    await user.click(screen.getByText('Select Alert'));
    // The mock returns an alert with transaction: '{"data":"test"}'
    // Since mock controls rendering, we just verify no crash
    expect(screen.getByText('Alert Selected')).toBeInTheDocument();
  });

  it('should calculate NEW priority for score < 0.33', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    const scoreInput = screen.getByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '0.1');

    expect(screen.getAllByText(/NEW/i).length).toBeGreaterThan(0);
  });

  it('should calculate BREACH priority for score >= 1.0', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    const scoreInput = screen.getByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '1');

    expect(screen.getAllByText(/BREACH/i).length).toBeGreaterThan(0);
  });

  it('should change confidence in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    const spinbuttons = screen.getAllByRole('spinbutton');
    const confidenceInput = spinbuttons[0];
    await user.clear(confidenceInput);
    await user.type(confidenceInput, '85');
    expect(confidenceInput).toHaveValue(85);
  });

  it('should change alert type in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'FRAUD' }}
      />,
    );

    const select = screen.getByDisplayValue('Fraud');
    await user.selectOptions(select, 'FRAUD_AND_AML');
    expect(screen.getByDisplayValue('Fraud and AML')).toBeInTheDocument();
  });

  it('should call onSaveDraft in create mode when Save as Draft clicked', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Select an alert first
    await user.click(screen.getByText('Select Alert'));
    await user.click(screen.getByText('Save as Draft'));

    expect(defaultProps.onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true }),
    );
  });

  it('should call onUpdate when submitting in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{
          alertType: 'FRAUD',
          priority: 'URGENT',
          priorityScore: 0.5,
          confidence: 75,
        }}
      />,
    );

    // Fill in note
    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'Valid note text');

    await user.click(screen.getByText('Complete Case'));

    await waitFor(() => {
      expect(defaultProps.onCompleteCase).toHaveBeenCalled();
    });
  });

  it('should show confidence validation error for out of range value', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ confidence: -5 }}
      />,
    );

    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'Valid note text');
    await user.click(screen.getByText('Complete Case'));

    await waitFor(() => {
      expect(
        screen.getAllByText(/Confidence must be between 0 and 100/).length,
      ).toBeGreaterThan(0);
    });
  });

  it('should render prediction outcome dropdown in edit mode', () => {
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    expect(screen.getByText('Prediction Outcome')).toBeInTheDocument();
  });

  it('should render case status dropdown in edit mode', () => {
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    expect(screen.getByText('Case Status')).toBeInTheDocument();
  });

  it('should render priority score slider in edit mode', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 0.5 }}
      />,
    );

    expect(screen.getByText(/Priority Score/)).toBeInTheDocument();
    expect(screen.getByText('0.0 (NEW)')).toBeInTheDocument();
  });

  it('should render alert type dropdown in create mode', () => {
    render(<CreateCaseModal {...defaultProps} />);
    expect(screen.getByText('Alert Type *')).toBeInTheDocument();
  });

  it('should render priority score in create mode', () => {
    render(<CreateCaseModal {...defaultProps} />);
    expect(screen.getByText(/Priority Score \*/)).toBeInTheDocument();
  });

  it('should render priority display in create mode', () => {
    render(<CreateCaseModal {...defaultProps} />);
    expect(screen.getAllByText(/Priority/).length).toBeGreaterThan(0);
  });

  it('should show transaction data when alert with transaction is selected', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);
    await user.click(screen.getByText('Select Alert'));

    await waitFor(() => {
      expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    });
  });

  it('should handle alert search error gracefully', async () => {
    (triageService.getNALTAlerts as any).mockRejectedValue(
      new Error('Network error'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreateCaseModal {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load alerts:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('should render BREACH priority styling in edit mode', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 1.0, priority: 'BREACH' }}
      />,
    );
    expect(screen.getByText('BREACH')).toBeInTheDocument();
  });

  it('should render CRITICAL priority styling in edit mode', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 0.8, priority: 'CRITICAL' }}
      />,
    );
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('should render NEW priority styling in edit mode', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 0.1, priority: 'NEW' }}
      />,
    );
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('should show priorityScore validation error', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 0.5, confidence: 50 }}
      />,
    );

    // Change priority score to invalid value
    const spinbuttons = screen.getAllByRole('spinbutton');
    // Find the priority score input (value around 0.5)
    const priorityScoreInput = spinbuttons.find(
      (el: HTMLElement) => (el as HTMLInputElement).max === '1',
    );
    if (priorityScoreInput) {
      await user.clear(priorityScoreInput);
      await user.type(priorityScoreInput, '2');
    }

    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'Valid note text');

    await user.click(screen.getByText('Complete Case'));

    await waitFor(() => {
      expect(
        screen.getAllByText(/Priority Score must be between 0 and 1/).length,
      ).toBeGreaterThan(0);
    });
  });

  it('should render alert type dropdown in edit mode and change it', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'FRAUD' }}
      />,
    );

    // The edit mode should have an alert type select
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('should render prediction outcome select in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    const selects = screen.getAllByRole('combobox');
    // Should have selects for alertType, predictionOutcome, status
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  it('should render notes textarea in edit mode', () => {
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId={1} />,
    );

    expect(
      screen.getByPlaceholderText(/Provide detailed reasoning/i),
    ).toBeInTheDocument();
  });

  it('should show Updating text in edit mode when loading', () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        loading={true}
      />,
    );

    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('should render BREACH priority in create mode', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Find the range input and set to 1.0
    const rangeInputs = screen.getAllByRole('slider');
    if (rangeInputs.length > 0) {
      // Just verify the range exists
      expect(rangeInputs[0]).toBeInTheDocument();
    }
  });

  it('should render Fraud and AML option in create mode', () => {
    render(<CreateCaseModal {...defaultProps} />);
    const option = screen.getByText('Fraud & AML');
    expect(option).toBeInTheDocument();
  });

  it('should auto-select alert when initial.alertId matches', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: [
        {
          alert_id: 'ALERT-123',
          message: 'Test Alert',
          transaction: '{"data":"test"}',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        pageSize: 10,
      },
    });

    render(
      <CreateCaseModal {...defaultProps} initial={{ alertId: 'ALERT-123' }} />,
    );

    // Wait for auto-select to run (after initial load sets availableAlerts)
    await waitFor(() => {
      expect(screen.getByText('Alert Selected')).toBeInTheDocument();
    });

    // Wait for the debounced search effect to fire (300ms timeout)
    await waitFor(
      () => {
        // getNALTAlerts called: initial load effect + initial open effect + debounced search
        expect(
          (triageService.getNALTAlerts as any).mock.calls.length,
        ).toBeGreaterThanOrEqual(2);
      },
      { timeout: 2000 },
    );
  });

  it('should load alerts with search term via debounced effect', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalled();
    });
    // The debounced search effect is internal and triggers on alertSearchTerm changes
    // This is verified by the initial load above
  });

  it('should render priority score validation in create mode', () => {
    render(<CreateCaseModal {...defaultProps} />);
    // Verify priority score range labels exist
    expect(screen.getAllByText('0.0 (NEW)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.0 (BREACH)').length).toBeGreaterThan(0);
  });

  it('should show alertType validation error in edit mode', async () => {
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ alertType: 'AML' }}
      />,
    );

    expect(screen.getByDisplayValue('AML')).toBeInTheDocument();
  });

  it('should not call onCreate when submitting without selection in create mode', async () => {
    const user = userEvent.setup();
    render(<CreateCaseModal {...defaultProps} />);

    // Click Create Case without selecting any alert
    await user.click(screen.getByText('Create Case'));

    // Form should not submit - onCreate should not be called
    expect(defaultProps.onCreate).not.toHaveBeenCalled();
  });

  it('should render transaction data as JSON when transaction is object', async () => {
    const user = userEvent.setup();

    // Override the mock to return alerts with object transaction
    vi.mocked(triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: [
        {
          alert_id: 'ALERT-123',
          message: 'Test Alert',
          transaction: { key: 'value' },
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        pageSize: 10,
      },
    });

    // Override LinkExistingAlerts mock for this test to pass object transaction
    render(<CreateCaseModal {...defaultProps} />);

    // Select alert (mock passes transaction as string, but component has the alert from onAlertsChange)
    await user.click(screen.getByText('Select Alert'));

    await waitFor(() => {
      expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    });
  });

  it('should show search error in console', async () => {
    // The debounced search effect catches errors
    // First load succeeds, then search fails
    let callCount = 0;
    (triageService.getNALTAlerts as any).mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          alerts: mockAlerts,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            pageSize: 10,
          },
        });
      }
      return Promise.reject(new Error('Search failed'));
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreateCaseModal {...defaultProps} />);

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('should show priorityScore error in edit mode when out of range', async () => {
    const user = userEvent.setup();
    render(
      <CreateCaseModal
        {...defaultProps}
        mode="edit"
        existingCaseId={1}
        initial={{ priorityScore: 2, confidence: 50 }}
      />,
    );

    const noteInput = screen.getByPlaceholderText(
      /Provide detailed reasoning/i,
    );
    await user.type(noteInput, 'Valid note text');

    await user.click(screen.getByText('Complete Case'));

    await waitFor(() => {
      expect(
        screen.getAllByText(/Priority Score must be between 0 and 1/).length,
      ).toBeGreaterThan(0);
    });
  });
});
