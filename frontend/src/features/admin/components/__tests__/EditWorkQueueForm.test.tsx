import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import EditWorkQueueForm from '../EditWorkQueueForm';
import { mockWorkQueue } from '../../constants/workQueues';
import * as useSystemConfig from '../../../../shared/hooks/useSystemConfig';

describe('EditWorkQueueForm', () => {
  beforeEach(() => {
    // Mock the useSystemConfig hook
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

  it('should render the form with the correct initial values', () => {
    render(
      <EditWorkQueueForm
        queue={mockWorkQueue}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByLabelText('Queue Name')).toHaveValue(mockWorkQueue.name);
    expect(screen.getByLabelText('Description')).toHaveValue(
      mockWorkQueue.description
    );
    expect(screen.getByLabelText('Status')).toHaveValue(mockWorkQueue.status);
  });

  it('should call onSave with the updated data when the form is submitted', () => {
    const handleSave = vi.fn();
    render(
      <EditWorkQueueForm
        queue={mockWorkQueue}
        onSave={handleSave}
        onCancel={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('Queue Name'), {
      target: { value: 'New Queue Name' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'New Description' },
    });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(handleSave).toHaveBeenCalledWith({
      ...mockWorkQueue,
      name: 'New Queue Name',
      description: 'New Description',
    });
  });
});


