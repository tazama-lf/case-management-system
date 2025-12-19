import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BlockAllowListStatus from '../BlockAllowListStatus';

describe('BlockAllowListStatus', () => {
  it('renders with status select', () => {
    render(<BlockAllowListStatus status="Allowed" />);

    expect(screen.getByText('Block/Allow List Status')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('displays the correct default value', () => {
    render(<BlockAllowListStatus status="Blocked" />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('Blocked');
  });

  it('renders all status options', () => {
    render(<BlockAllowListStatus status="Not Listed" />);

    expect(screen.getByText('Not Listed')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Allowed')).toBeInTheDocument();
    expect(screen.getByText('Under Review')).toBeInTheDocument();
    expect(screen.getByText('Pending Investigation')).toBeInTheDocument();
  });
});

