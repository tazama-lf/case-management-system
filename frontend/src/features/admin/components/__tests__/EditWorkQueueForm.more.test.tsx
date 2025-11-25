import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import EditWorkQueueForm from '../EditWorkQueueForm';
import { mockWorkQueue } from '../../constants/workQueues';
import * as useSystemConfig from '../../../../shared/hooks/useSystemConfig';

describe('EditWorkQueueForm thorough behaviors', () => {
  beforeEach(() => {
    vi.spyOn(useSystemConfig, 'useSystemConfig').mockReturnValue({
      roles: [{ id: '1', name: 'Admin' }],
      caseTypes: [{ id: '1', name: 'Type 1' }],
      caseStatuses: [{ id: '1', name: 'Status 1' }],
      taskTypes: [{ id: '1', name: 'Task Type 1' }],
      investigators: [],
      systemConfig: null,
      loading: false,
      error: null,
    });
  });

  it('removes a role when the remove button is clicked', () => {
    render(
      <EditWorkQueueForm queue={mockWorkQueue} onSave={() => {}} onCancel={() => {}} />
    );

    // Ensure initial role exists
    expect(screen.getByText('Supervisor')).toBeInTheDocument();

    // Find the remove button for Supervisor (first × button)
    const removeButtons = screen.getAllByText('×');
    // click the first one which corresponds to Supervisor
    fireEvent.click(removeButtons[0]);

    // Supervisor should no longer be present
    const spans = screen.queryAllByText('Supervisor');
    expect(spans.length).toBe(0);
  });

  it('removes a task type when the remove button is clicked', () => {
    render(
      <EditWorkQueueForm queue={mockWorkQueue} onSave={() => {}} onCancel={() => {}} />
    );

    expect(screen.getByText('New Case')).toBeInTheDocument();

    // The task type remove buttons are the × buttons after role removes; find by role-ish structure
    const removeButtons = screen.getAllByText('×');
    // Roles have 2 remove buttons initially, task types follow — click a later one
    // pick the third remove button for safety (roles: 2, taskTypes: 2 so third belongs to first task type)
    if (removeButtons.length >= 3) {
      fireEvent.click(removeButtons[2]);
    }

    const removed = screen.queryAllByText('New Case');
    expect(removed.length).toBe(0);
  });

  it('calls onSave with newly added role and task type included', () => {
    const onSave = vi.fn();
    render(<EditWorkQueueForm queue={mockWorkQueue} onSave={onSave} onCancel={() => {}} />);

    const selects = screen.getAllByRole('combobox');
    const roleSelect = selects[1];
    const taskSelect = selects[2];

    // Add AML Specialist and AML Alert
    fireEvent.change(roleSelect, { target: { value: 'AML Specialist' } });
    fireEvent.change(taskSelect, { target: { value: 'AML Alert' } });

    // Change name/description to ensure values propagate
    fireEvent.change(screen.getByLabelText('Queue Name'), { target: { value: 'Submitted Queue' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Submitted Desc' } });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(onSave).toHaveBeenCalled();
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('Submitted Queue');
    expect(saved.description).toBe('Submitted Desc');
    expect(saved.roles).toContain('AML Specialist');
    expect(saved.taskTypes).toContain('AML Alert');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<EditWorkQueueForm queue={mockWorkQueue} onSave={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
