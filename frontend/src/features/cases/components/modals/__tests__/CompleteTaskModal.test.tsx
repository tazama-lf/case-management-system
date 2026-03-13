import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompleteTaskModal from '../CompleteTaskModal';
import type { UnifiedWorkQueueTask } from '../../../types/task.types';

/* ------------------------------------------------------------------ */
/*  Mock heroicons                                                     */
/* ------------------------------------------------------------------ */
vi.mock('@heroicons/react/24/outline', () => ({
  CheckIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'check-icon' }),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const baseTask: UnifiedWorkQueueTask = {
  id: 123,
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 100,
  description: 'Review suspicious transaction',
};

const amlTask: UnifiedWorkQueueTask = {
  ...baseTask,
  name: 'Investigate AML',
};

const fraudTask: UnifiedWorkQueueTask = {
  ...baseTask,
  name: 'Investigate Fraud',
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onCompleteTask: vi.fn(),
  task: baseTask,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CompleteTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* --- Visibility --- */

  it('does not render when open is false', () => {
    render(<CompleteTaskModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Complete Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(<CompleteTaskModal {...defaultProps} task={null} />);
    expect(screen.queryByText('Complete Task')).not.toBeInTheDocument();
  });

  it('does not render when task is undefined', () => {
    render(<CompleteTaskModal {...defaultProps} task={undefined} />);
    expect(screen.queryByText('Complete Task')).not.toBeInTheDocument();
  });

  /* --- Rendering --- */

  it('renders modal heading, icon, and task info', () => {
    render(<CompleteTaskModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Complete Task/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('check-icon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
  });

  it('renders action info banner', () => {
    render(<CompleteTaskModal {...defaultProps} />);
    expect(screen.getByText(/This task will be marked as/)).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('renders notes textarea', () => {
    render(<CompleteTaskModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Add any notes about the task completion/i)).toBeInTheDocument();
  });

  /* --- Recommended Outcome Dropdown --- */

  it('does not show recommended outcome for regular tasks', () => {
    render(<CompleteTaskModal {...defaultProps} />);
    expect(screen.queryByText(/Recommended Outcome/i)).not.toBeInTheDocument();
  });

  it('shows recommended outcome dropdown for Investigate AML task', () => {
    render(<CompleteTaskModal {...defaultProps} task={amlTask} />);
    expect(screen.getByText(/Recommended Outcome/i)).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows recommended outcome dropdown for Investigate Fraud task', () => {
    render(<CompleteTaskModal {...defaultProps} task={fraudTask} />);
    expect(screen.getByText(/Recommended Outcome/i)).toBeInTheDocument();
  });

  it('has correct default outcome value', () => {
    render(<CompleteTaskModal {...defaultProps} task={amlTask} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('STATUS_83_CLOSED_INCONCLUSIVE');
  });

  it('allows changing recommended outcome', async () => {
    const user = userEvent.setup();
    render(<CompleteTaskModal {...defaultProps} task={amlTask} />);
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'STATUS_81_CLOSED_REFUTED');
    expect((select as HTMLSelectElement).value).toBe('STATUS_81_CLOSED_REFUTED');
  });

  it('renders all three outcome options', () => {
    render(<CompleteTaskModal {...defaultProps} task={amlTask} />);
    // formatOutcome converts STATUS_83_CLOSED_INCONCLUSIVE -> "83 Closed Inconclusive"
    expect(screen.getByText(/83 Closed Inconclusive/i)).toBeInTheDocument();
    expect(screen.getByText(/81 Closed Refuted/i)).toBeInTheDocument();
    expect(screen.getByText(/82 Closed Confirmed/i)).toBeInTheDocument();
  });

  /* --- Interactions --- */

  it('calls onCompleteTask with task and notes on complete', async () => {
    const user = userEvent.setup();
    render(<CompleteTaskModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/Add any notes/i), 'Done reviewing');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));

    expect(defaultProps.onCompleteTask).toHaveBeenCalledWith(
      baseTask,
      'Done reviewing',
      undefined,
    );
  });

  it('calls onCompleteTask with task, notes, and recommendedOutcome for AML tasks', async () => {
    const user = userEvent.setup();
    render(<CompleteTaskModal {...defaultProps} task={amlTask} />);

    await user.selectOptions(screen.getByRole('combobox'), 'STATUS_82_CLOSED_CONFIRMED');
    await user.type(screen.getByPlaceholderText(/Add any notes/i), 'Confirmed fraud');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));

    expect(defaultProps.onCompleteTask).toHaveBeenCalledWith(
      amlTask,
      'Confirmed fraud',
      'STATUS_82_CLOSED_CONFIRMED',
    );
  });

  it('sends undefined notes when no notes entered', async () => {
    const user = userEvent.setup();
    render(<CompleteTaskModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));

    expect(defaultProps.onCompleteTask).toHaveBeenCalledWith(baseTask, undefined, undefined);
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    render(<CompleteTaskModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  /* --- Loading state --- */

  it('disables buttons when loading', () => {
    render(<CompleteTaskModal {...defaultProps} loading={true} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Complete Task/i })).toBeDisabled();
  });

  it('disables outcome dropdown when loading', () => {
    render(<CompleteTaskModal {...defaultProps} task={amlTask} loading={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  /* --- Reset on task change --- */

  it('resets notes and outcome when task changes', () => {
    const { rerender } = render(<CompleteTaskModal {...defaultProps} task={amlTask} />);
    // Rerender with different task
    rerender(<CompleteTaskModal {...defaultProps} task={fraudTask} />);
    const textarea = screen.getByPlaceholderText(/Add any notes/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('STATUS_83_CLOSED_INCONCLUSIVE');
  });
});
