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

// Mock child component
vi.mock('../LinkExistingAlerts', () => ({
  default: ({ onAlertsChange }: any) => (
    <div data-testid="link-existing-alerts">
      <button
        onClick={() =>
          onAlertsChange([{ alert_id: 'ALERT-123', transaction: 'test' }])
        }
      >
        Select Alert
      </button>
    </div>
  ),
}));

describe('CreateCaseModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
  };

  const mockAlerts = [
    { alert_id: 'ALERT-123', message: 'Test Alert', transaction: 'test data' },
  ];

  const mockUsers = [{ id: 'user-1', name: 'John Doe', role: 'Investigator' }];

  beforeEach(() => {
    vi.resetAllMocks();
    (triageService.getNALTAlerts as any).mockResolvedValue(mockAlerts);
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
      expect(userService.getAllUsers).toHaveBeenCalled();
    });
  });

  it('should render correctly in edit mode', () => {
    render(
      <CreateCaseModal {...defaultProps} mode="edit" existingCaseId="CASE-1" />,
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

    // Draft button should be enabled
    const draftButton = screen.getByText('Save as Draft');
    expect(draftButton).not.toBeDisabled();

    // Clicking draft should proceed without validation errors
    await user.click(draftButton);
    expect(defaultProps.onCreate).toHaveBeenCalled();
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
        alertId: 'ALERT-123',
        alertType: 'AML',
        priority: expect.any(String),
        priorityScore: expect.any(Number),
        draft: false,
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

    expect(defaultProps.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'ALERT-123',
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
});
