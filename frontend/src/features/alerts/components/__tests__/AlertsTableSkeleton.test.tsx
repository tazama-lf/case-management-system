import React from 'react';
import { render } from '@testing-library/react';
import AlertsTableSkeleton from '../AlertsTableSkeleton';
import { describe, it, expect, vi } from 'vitest';

describe('AlertsTableSkeleton', () => {
  it('renders the provided number of placeholder rows', () => {
    const { container } = render(<AlertsTableSkeleton rows={3} />);
    const rows = container.querySelectorAll('.divide-y > div');
    expect(rows.length).toBe(3);
  });
});
