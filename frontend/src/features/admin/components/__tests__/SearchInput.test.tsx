import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchInput from '../SearchInput';
import { describe, it, expect, vi } from 'vitest';

describe('SearchInput', () => {
  it('renders and calls onChange', () => {
    const handleChange = vi.fn();
    render(<SearchInput value="foo" onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('foo');
    fireEvent.change(input, { target: { value: 'bar' } });
    expect(handleChange).toHaveBeenCalled();
  });
});
