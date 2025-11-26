import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkQueueManagement from '../WorkQueueManagement';
import { describe, it, expect, vi } from 'vitest';

describe('WorkQueueManagement', () => {
  it('renders without crashing', () => {
    render(<WorkQueueManagement />);
    expect(screen.getByText(/Manage work queues for different user groups/i)).toBeInTheDocument();
  });
});
