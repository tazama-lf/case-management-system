import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import { describe, it, expect, vi } from 'vitest';

describe('AdminDashboard', () => {
  it('renders dashboard', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument();
  });
});
