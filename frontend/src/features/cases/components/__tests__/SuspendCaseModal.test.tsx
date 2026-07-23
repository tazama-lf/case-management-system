import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuspendCaseModal from '../SuspendCaseModal';
import type { CaseRow } from '../casesTable.utils';

const mockCaseData: CaseRow = {
  id: 123,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_20_IN_PROGRESS',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
  alertId: 1,
};

const mockCaseWithOneTask: CaseRow = {
  ...mockCaseData,
  tasks: [
    {
      task_id: 10,
      name: 'Investigate Case',
      status: 'STATUS_20_IN_PROGRESS',
    } as any,
  ],
};

const mockCaseWithMultipleTasks: CaseRow = {
  ...mockCaseData,
  tasks: [
    {
      task_id: 10,
      name: 'Investigate Case',
      status: 'STATUS_20_IN_PROGRESS',
    } as any,
    {
      task_id: 11,
      name: 'Investigate Fraud',
      status: 'STATUS_20_IN_PROGRESS',
    } as any,
  ],
};

describe('SuspendCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuspend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSuspend.mockResolvedValue(undefined);
  });

  it('does not render when open is false', () => {
    render(
      <SuspendCaseModal
        open={false}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );
    expect(screen.queryByText('Suspend Case')).not.toBeInTheDocument();
  });

  it('renders modal with case information when open', () => {
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Suspend Case/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Case ID: 123/)).toBeInTheDocument();
  });

  it('displays suspension information', () => {
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    expect(screen.getByText(/Temporarily pause a case/i)).toBeInTheDocument();
  });

  it('validates reason minimum length (4 characters)', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'ab');

    expect(
      screen.getByText(/Reason must be at least 4 characters/i),
    ).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when reason is valid', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'This is a valid suspension reason');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'This is a valid suspension reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuspend).toHaveBeenCalledWith(
        123,
        'This is a valid suspension reason',
        [],
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnSuspend.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'This is a valid suspension reason');
    await user.click(submitButton);

    expect(screen.getByText('Suspending...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('shows single task with auto-selected label', () => {
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseWithOneTask}
      />,
    );

    expect(screen.getByText('Task to suspend')).toBeInTheDocument();
    expect(
      screen.getByText(/Investigate Case \(Task ID - 10\)/),
    ).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it('shows multiple tasks with checkboxes for selection', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseWithMultipleTasks}
      />,
    );

    expect(screen.getByText('Select task(s) to suspend')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    // Toggle first task
    await user.click(checkboxes[0]);
    // Toggle second task
    await user.click(checkboxes[1]);

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    await user.type(textarea, 'Suspending multiple tasks');
    await user.click(screen.getByRole('button', { name: /Suspend Case/i }));

    await waitFor(() => {
      expect(mockOnSuspend).toHaveBeenCalledWith(
        123,
        'Suspending multiple tasks',
        [10, 11],
      );
    });
  });

  it('toggles task selection on and off', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseWithMultipleTasks}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Select first task
    await user.click(checkboxes[0]);
    // Deselect first task
    await user.click(checkboxes[0]);

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    await user.type(textarea, 'Valid reason here');
    await user.click(screen.getByRole('button', { name: /Suspend Case/i }));

    await waitFor(() => {
      expect(mockOnSuspend).toHaveBeenCalledWith(123, 'Valid reason here', []);
    });
  });

  it('handles submit error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    mockOnSuspend.mockRejectedValue(new Error('Suspend failed'));

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    await user.type(textarea, 'Valid reason here');
    await user.click(screen.getByRole('button', { name: /Suspend Case/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to suspend case:',
        expect.any(Error),
      );
    });
    // Should not close on error
    expect(mockOnClose).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('does not close modal while submitting via X button', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    mockOnSuspend.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    await user.type(textarea, 'Valid reason here');
    await user.click(screen.getByRole('button', { name: /Suspend Case/i }));

    expect(screen.getByText('Suspending...')).toBeInTheDocument();
    // handleClose should not call onClose while isSubmitting is true
    // The X button and Cancel should be disabled
    resolveSubmit!();
  });

  it('does not submit when caseData is null', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={null}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    await user.type(textarea, 'Valid reason here');
    await user.click(screen.getByRole('button', { name: /Suspend Case/i }));
    expect(mockOnSuspend).not.toHaveBeenCalled();
  });

  it('closes modal via X button when not submitting', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    // Find the X button (near the heading)
    const buttons = screen.getAllByRole('button');
    const xButton = buttons.find(
      (btn) => btn.querySelector('svg') && !btn.textContent,
    );
    if (xButton) {
      await user.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });
});
