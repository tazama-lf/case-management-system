import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusFilter from '../StatusFilter';
import { describe, it, expect, vi } from 'vitest';

describe('StatusFilter', () => {
  it('renders and calls onChange', () => {
    const handleChange = vi.fn();
    render(<StatusFilter value="All Status" onChange={handleChange} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('All Status');
    fireEvent.change(select, { target: { value: 'Active' } });
    expect(handleChange).toHaveBeenCalledWith('Active');
  });
});
