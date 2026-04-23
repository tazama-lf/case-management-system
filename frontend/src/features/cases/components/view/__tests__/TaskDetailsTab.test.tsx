import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskDetailsTab from '../TaskDetailsTab';
import type { CaseRow } from '../../casesTable.utils';
import type { TaskForSupervisor } from '../../../services/taskService';
import userService from '../../../services/userService';

vi.mock('../../../services/userService');

const mockCaseRow: CaseRow = {
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

const mockTask: TaskForSupervisor = {
  task_id: 1,
  name: 'Investigate Case',
  description: 'Investigate the case thoroughly',
  status: 'STATUS_20_IN_PROGRESS',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-02T00:00:00Z',
  case_id: 123,
  assigned_user_id: 'user-1',
  candidateGroup: 'investigations',
  case: {
    case_id: 123,
    case_type: 'FRAUD',
    priority: 'HIGH',
  },
};

describe('TaskDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (userService.getUserDetailsById as vi.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      username: 'jdoe',
    });
  });

  it('renders loading state when loadingTasks is true', () => {
    render(<TaskDetailsTab row={mockCaseRow} loadingTasks={true} />);
    expect(screen.getByText('Loading task...')).toBeInTheDocument();
  });

  it('renders no task message when no tasks provided', () => {
    render(<TaskDetailsTab row={mockCaseRow} tasks={[]} />);
    expect(
      screen.getByText('No task information available'),
    ).toBeInTheDocument();
  });

  it('displays task information when task is provided', async () => {
    render(<TaskDetailsTab row={mockCaseRow} tasks={[mockTask]} />);

    await waitFor(() => {
      expect(screen.getByText('TASK-1', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
  });

  it('fetches user details when task has assigned_user_id', async () => {
    render(<TaskDetailsTab row={mockCaseRow} tasks={[mockTask]} />);

    await waitFor(() => {
      expect(userService.getUserDetailsById).toHaveBeenCalledWith('user-1');
    });
  });

  it('displays case information', () => {
    render(<TaskDetailsTab row={mockCaseRow} tasks={[mockTask]} />);
    expect(screen.getByText('CASE-123', { exact: false })).toBeInTheDocument();
  });
});
