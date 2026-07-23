import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompleteTaskModal from '../CompleteTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';

const mockTask: UnifiedWorkQueueTask = {
  id: 'TASK-123',
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 'CASE-123',
  assignee: null,
  created: '2024-01-01T00:00:00Z',
  dueDate: null,
  description: 'Review suspicious transaction',
};

const mockInvestigateAmlTask: UnifiedWorkQueueTask = {
  ...mockTask,
  id: 'TASK-AML',
  name: 'Investigate AML',
};

const mockInvestigateFraudTask: UnifiedWorkQueueTask = {
  ...mockTask,
  id: 'TASK-FRAUD',
  name: 'Investigate Fraud',
};

describe('CompleteTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <CompleteTaskModal
        open={false}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(screen.queryByText(/Complete Task/i)).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={null}
      />,
    );
    expect(screen.queryByText(/Complete Task/i)).not.toBeInTheDocument();
  });

  it('does not render when task is undefined', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
      />,
    );
    expect(screen.queryByText(/Complete Task/i)).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Complete Task/i }),
    ).toBeInTheDocument();
  });

  it('displays task ID and name', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('displays task status', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
  });

  it('displays action info box', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(
      screen.getByText(/This task will be marked as/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('does not show Recommended Outcome for non-investigation tasks', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(screen.queryByText(/Recommended Outcome/i)).not.toBeInTheDocument();
  });

  it('shows Recommended Outcome dropdown for Investigate AML task', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    expect(screen.getByText(/Recommended Outcome/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows Recommended Outcome dropdown for Investigate Fraud task', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateFraudTask}
      />,
    );
    expect(screen.getByText(/Recommended Outcome/i)).toBeInTheDocument();
  });

  it('has three outcome options in dropdown', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('defaults Recommended Outcome to STATUS_83_CLOSED_INCONCLUSIVE', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('STATUS_83_CLOSED_INCONCLUSIVE');
  });

  it('allows changing the recommended outcome', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'STATUS_82_CLOSED_CONFIRMED');
    expect(select).toHaveValue('STATUS_82_CLOSED_CONFIRMED');
  });

  it('formats outcome text correctly in dropdown options', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    // formatOutcome removes STATUS_ prefix, replaces _ with spaces, capitalizes first letter
    expect(screen.getByText('83 CLOSED INCONCLUSIVE')).toBeInTheDocument();
    expect(screen.getByText('81 CLOSED REFUTED')).toBeInTheDocument();
    expect(screen.getByText('82 CLOSED CONFIRMED')).toBeInTheDocument();
  });

  it('allows entering completion notes', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any notes about the task completion/i,
    );
    await user.type(textarea, 'Task completed successfully');
    expect(textarea).toHaveValue('Task completed successfully');
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onCompleteTask with task and notes when Complete Task is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any notes about the task completion/i,
    );
    await user.type(textarea, 'Done');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));
    expect(mockOnComplete).toHaveBeenCalledWith(mockTask, 'Done', undefined);
  });

  it('calls onCompleteTask with recommendedOutcome for investigation tasks', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'STATUS_82_CLOSED_CONFIRMED');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));
    expect(mockOnComplete).toHaveBeenCalledWith(
      mockInvestigateAmlTask,
      undefined,
      'STATUS_82_CLOSED_CONFIRMED',
    );
  });

  it('calls onCompleteTask with both notes and recommendedOutcome', async () => {
    const user = userEvent.setup();
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateFraudTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any notes about the task completion/i,
    );
    await user.type(textarea, 'Investigation complete');
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'STATUS_81_CLOSED_REFUTED');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));
    expect(mockOnComplete).toHaveBeenCalledWith(
      mockInvestigateFraudTask,
      'Investigation complete',
      'STATUS_81_CLOSED_REFUTED',
    );
  });

  it('resets form fields after completing a task', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any notes about the task completion/i,
    );
    await user.type(textarea, 'Some notes');
    await user.click(screen.getByRole('button', { name: /Complete Task/i }));

    // Reopen the modal
    rerender(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    const newTextarea = screen.getByPlaceholderText(
      /Add any notes about the task completion/i,
    );
    expect(newTextarea).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue(
      'STATUS_83_CLOSED_INCONCLUSIVE',
    );
  });

  it('disables buttons when loading is true', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockTask}
        loading={true}
      />,
    );
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Complete Task/i }),
    ).toBeDisabled();
  });

  it('disables outcome dropdown when loading is true', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
        loading={true}
      />,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows outcome hint text for investigation tasks', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onCompleteTask={mockOnComplete}
        task={mockInvestigateAmlTask}
      />,
    );
    expect(
      screen.getByText(
        /Select the outcome based on your investigation findings/i,
      ),
    ).toBeInTheDocument();
  });
});
