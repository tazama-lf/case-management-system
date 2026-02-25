import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditWorkQueueForm from '../EditWorkQueueForm';
import { mockWorkQueue } from '../../constants/workQueues';
import * as useSystemConfig from '../../../../shared/hooks/useSystemConfig';

describe('EditWorkQueueForm additional behaviors', () => {
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

  it('adds a role when selected from the dropdown', () => {
    render(
      <EditWorkQueueForm
        queue={mockWorkQueue}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // selects[0] = status, selects[1] = role select, selects[2] = task select
    const roleSelect = selects[1];

    fireEvent.change(roleSelect, { target: { value: 'AML Specialist' } });

    const amlRoleMatches = screen.getAllByText('AML Specialist');
    // there will be an <option> and a tag; ensure a tag/span exists
    expect(
      amlRoleMatches.some((el) => el.tagName.toLowerCase() === 'span'),
    ).toBe(true);
  });

  it('adds a task type when selected from the dropdown', () => {
    render(
      <EditWorkQueueForm
        queue={mockWorkQueue}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    const taskSelect = selects[2];

    fireEvent.change(taskSelect, { target: { value: 'AML Alert' } });

    const amlTaskMatches = screen.getAllByText('AML Alert');
    expect(
      amlTaskMatches.some((el) => el.tagName.toLowerCase() === 'span'),
    ).toBe(true);
  });
});
