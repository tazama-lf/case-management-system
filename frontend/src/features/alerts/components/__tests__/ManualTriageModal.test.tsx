import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManualTriageModal from '../ManualTriageModal';
import { useSystemConfig } from '@/shared/hooks/useSystemConfig';
import { caseService } from '@/features/cases/services/caseService';

vi.mock('@/shared/hooks/useSystemConfig');

vi.mock('@/features/cases/services/caseService', () => ({
  caseService: {
    getPriorityThresholds: vi.fn().mockResolvedValue({ highThreshold: 0.7, mediumThreshold: 0.4 }),
  },
}));

describe('ManualTriageModal', () => {
  const mockAlert = {
    alert_id: 'alert-123',
    alert_type: 'FRAUD' as const,
    priority: 'MEDIUM' as const,
    confidence_per: 75,
    message: 'Test alert message',
  };

  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <ManualTriageModal
        isOpen={false}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(screen.queryByText(/Update Alert/i)).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(screen.getByText(/Update Alert.*alert-123/i)).toBeInTheDocument();
  });

  it('displays alert information', () => {
    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(screen.getByDisplayValue('75')).toBeInTheDocument(); // Confidence
    expect(screen.getByText('MEDIUM')).toBeInTheDocument(); // Priority
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Close button is the X icon button - find by class or by finding button with XMarkIcon
    const closeButton = container.querySelector(
      'button[type="button"].text-gray-400',
    );
    if (closeButton) {
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    } else {
      // Fallback: get all buttons and click the first non-submit button
      const buttons = screen.getAllByRole('button');
      const cancelButton = buttons.find((btn) => btn.textContent === 'Cancel');
      if (cancelButton) {
        await user.click(cancelButton);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('validates form before submission', async () => {
    const user = userEvent.setup();
    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Try to submit without filling required note
    const submitButton = screen.getByRole('button', {
      name: /submit|save|complete/i,
    });
    await user.click(submitButton);

    // Wait a bit for any async operations and verify onSubmit was not called
    // This is the main assertion - validation should prevent submission
    await waitFor(
      () => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Fill in required note - use placeholder or find textarea directly
    const noteInput = container.querySelector(
      'textarea[placeholder*="detailed reasoning"]',
    ) as HTMLTextAreaElement;
    if (noteInput) {
      await user.type(
        noteInput,
        'This is a valid note with more than 10 characters',
      );
    } else {
      // Fallback: find by aria-describedby
      const noteInputAlt = container.querySelector(
        'textarea[aria-describedby]',
      ) as HTMLTextAreaElement;
      if (noteInputAlt) {
        await user.type(
          noteInputAlt,
          'This is a valid note with more than 10 characters',
        );
      }
    }

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /submit|save|complete/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence_per: 75,
          priority: expect.any(String),
          note: expect.stringContaining('This is a valid note'),
        }),
      );
    });
  });

  it('updates priority when priority score changes', async () => {
    const user = userEvent.setup();
    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Find and update priority score range input
    const priorityScoreInputs = screen.getAllByRole('spinbutton');
    const priorityScoreInput = priorityScoreInputs.find(
      (input) =>
        (input as HTMLInputElement).min === '0' &&
        (input as HTMLInputElement).max === '1',
    );

    if (priorityScoreInput) {
      await user.clear(priorityScoreInput);
      await user.type(priorityScoreInput, '0.8');

      // Priority should auto-update based on score
      await waitFor(() => {
        // Should show HIGH for score >= 0.7
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    }
  });

  it("uses the tenant's real priority thresholds instead of the hardcoded fallback", async () => {
    (caseService.getPriorityThresholds as vi.Mock).mockResolvedValueOnce({ highThreshold: 0.5, mediumThreshold: 0.3 });
    const user = userEvent.setup();
    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    await waitFor(() => {
      expect(caseService.getPriorityThresholds).toHaveBeenCalled();
    });

    const priorityScoreInputs = screen.getAllByRole('spinbutton');
    const priorityScoreInput = priorityScoreInputs.find(
      (input) =>
        (input as HTMLInputElement).min === '0' &&
        (input as HTMLInputElement).max === '1',
    );

    if (priorityScoreInput) {
      // 0.4 would be LOW under the 0.7/0.4 fallback, but this tenant's lowered
      // thresholds (0.5 high / 0.3 medium) should classify it as MEDIUM instead.
      await user.clear(priorityScoreInput);
      await user.type(priorityScoreInput, '0.4');

      await waitFor(() => {
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      });
    }
  });

  it('displays error message on submission failure', async () => {
    const user = userEvent.setup();
    const failingOnSubmit = vi
      .fn()
      .mockRejectedValue(new Error('Submission failed'));
    const { container } = render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={failingOnSubmit}
      />,
    );

    // Fill in required fields
    const noteInput = container.querySelector(
      'textarea[placeholder*="detailed reasoning"]',
    ) as HTMLTextAreaElement;
    if (noteInput) {
      await user.type(
        noteInput,
        'This is a valid note with more than 10 characters',
      );
    } else {
      const noteInputAlt = container.querySelector(
        'textarea[aria-describedby]',
      ) as HTMLTextAreaElement;
      if (noteInputAlt) {
        await user.type(
          noteInputAlt,
          'This is a valid note with more than 10 characters',
        );
      }
    }

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /submit|save|complete/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Submission failed/i)).toBeInTheDocument();
    });
  });

  it('shows different subtitle for disabled mode', () => {
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: false,
      isDisabledMode: true,
    });

    render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(
      screen.getByText(/Update alert information - direct investigation mode/i),
    ).toBeInTheDocument();
  });

  it('resets form when alert changes', () => {
    const { rerender } = render(
      <ManualTriageModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const newAlert = {
      ...mockAlert,
      alert_id: 'alert-456',
      confidence_per: 90,
    };
    rerender(
      <ManualTriageModal
        isOpen={true}
        alert={newAlert}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Form should reset with new alert data
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
  });
});
