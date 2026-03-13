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
  default: ({ onUploadComplete }: any) => (
    <div>
      Task Evidence Tab
      <button onClick={onUploadComplete}>Upload Complete</button>
    </div>
  ),
}));

vi.mock('../view/LinkedItemsTab', () => ({
  default: () => <div>Linked Items Tab</div>,
}));

vi.mock('../view/InvestigationNotesTab', () => ({
  default: ({ onNotesUpdate }: any) => (
    <div>
      Investigation Notes Tab
      <button onClick={onNotesUpdate}>Notes Updated</button>
    </div>
  ),
}));

vi.mock('../view/InvestigationsSummaryTab', () => ({
  default: ({ onTaskUpdate }: any) => (
    <div>
      Investigation Summary Tab
      <button onClick={onTaskUpdate}>Task Updated</button>
    </div>
  ),
}));

vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
}));

import TasksDetailsModal from '../TasksDetailsModal';

// Mock taskService - the component imports from '../services/taskService'
// We need to mock it at the path the component expects
// Since there's no services folder in components, this might be a path alias
// Let's mock both possible paths
vi.mock('../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));

// Import the mocked service
import { taskService } from '../../services/taskService';

const mockCaseData: CaseRow = {
  id: 123,
  alertId: 456,
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
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue([]);
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof TasksDetailsModal>>,
  ) => {
    return render(
      <TasksDetailsModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
        selectedTask={null}
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

    expect(
      screen.getByRole('heading', { name: /Task Details/i }),
    ).toBeInTheDocument();
  });

  it('fetches tasks when modal opens', async () => {
    const mockTasks = [
      {
        task_id: 'TASK-1',
        task_type: 'Review',
        status: 'IN_PROGRESS',
      },
    ];
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue(mockTasks);

    renderModal({});

    await waitFor(() => {
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(123);
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({});

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeButtons[0]); // Click the first close button

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('logs error when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(taskService.getTasksByCaseId).mockRejectedValue(
      new Error('Fetch failed'),
    );

    renderModal({});

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('switches tabs when tab button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(screen.getByRole('button', { name: 'Evidence' }));

    // After clicking, the Evidence tab content is visible
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
  });

  it('triggers onUploadComplete callback from TaskEvidenceTab', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(screen.getByRole('button', { name: 'Evidence' }));
    await user.click(screen.getByRole('button', { name: 'Upload Complete' }));
    // Just verify no error was thrown - state update happens internally
  });

  it('triggers onNotesUpdate callback from InvestigationNotesTab', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(
      screen.getByRole('button', { name: 'Investigation Notes' }),
    );
    await user.click(screen.getByRole('button', { name: 'Notes Updated' }));
    // Just verify no error was thrown - state update happens internally
  });

  it('triggers onTaskUpdate from InvestigationSummaryTab and calls prop', async () => {
    const user = userEvent.setup();
    const mockOnTaskUpdate = vi.fn();
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue([]);

    renderModal({ onTaskUpdate: mockOnTaskUpdate });

    await user.click(
      screen.getByRole('button', { name: 'Investigation Summary' }),
    );
    await user.click(screen.getByRole('button', { name: 'Task Updated' }));

    await waitFor(() => {
      expect(mockOnTaskUpdate).toHaveBeenCalled();
    });
  });
});
