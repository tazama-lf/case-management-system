import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkQueuesTable from '../WorkQueuesTable';
import { describe, it, expect, vi } from 'vitest';

describe('WorkQueuesTable', () => {
  it('renders table headers', () => {
    render(<WorkQueuesTable queues={[]} roleColors={{}} taskTypeColors={{}} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Name/i)).toBeInTheDocument();
  });
});
