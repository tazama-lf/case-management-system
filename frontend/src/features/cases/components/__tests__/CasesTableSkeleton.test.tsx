import React from 'react';
import { render, screen } from '@testing-library/react';
import CasesTableSkeleton from '../CasesTableSkeleton';
import { describe, it, expect } from 'vitest';

describe('CasesTableSkeleton', () => {
  it('renders correctly', () => {
    render(<CasesTableSkeleton />);
    // Check for table headers which are hardcoded in the skeleton
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(10); // 10 columns in the skeleton
  });

  it('renders correct number of rows', () => {
    render(<CasesTableSkeleton rows={3} />);
    // The skeleton renders rows in tbody
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 body rows
    expect(rows).toHaveLength(4);
  });
});
