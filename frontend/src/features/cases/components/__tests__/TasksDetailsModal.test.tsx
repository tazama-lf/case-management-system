import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock child components that have complex dependencies
vi.mock('../view/TaskDetailsTab', () => ({
  default: () => <div>Task Details Tab</div>,
}));

vi.mock('../view/TaskEvidenceTab', () => ({
  default: () => <div>Task Evidence Tab</div>,
}));

vi.mock('../view/LinkedItemsTab', () => ({
  default: () => <div>Linked Items Tab</div>,
}));

vi.mock('../view/InvestigationNotesTab', () => ({
  default: () => <div>Investigation Notes Tab</div>,
}));

vi.mock('../view/CustomerProfileTab', () => ({
  default: () => <div>Customer Profile Tab</div>,
}));

vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
}));

import TasksDetailsModal from '../TasksDetailsModal';

// Mock taskService - the component imports from '../services/taskService'
// We need to mock it at the path the component expects
// Since there's no services folder in components, this might be a path alias
// Let's mock both possible paths
vi.mock('../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));

vi.mock('../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));

// Import the mocked service
import { taskService } from '../../services/taskService';

const mockCaseData: CaseRow = {
  id: 'CASE-123',
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
};

describe('TasksDetailsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRefreshCases = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof TasksDetailsModal>>) => {
    return render(
      <TasksDetailsModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
        {...props}
      />,
    );
  };

  it('does not render when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();
  });

  it('does not render when row is null', () => {
    renderModal({ row: null });
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();
  });

  it('renders modal with task details when open', () => {
    renderModal({});

    expect(screen.getByRole('heading', { name: /Task Details/i })).toBeInTheDocument();
  });

  it('fetches tasks when modal opens', async () => {
    const mockTasks = [
      {
        task_id: 'TASK-1',
        task_type: 'Review',
        status: 'IN_PROGRESS',
      },
    ];
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);

    renderModal({});

    await waitFor(() => {
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith('CASE-123');
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({});

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeButtons[0]); // Click the first close button

    expect(mockOnClose).toHaveBeenCalled();
  });
});

