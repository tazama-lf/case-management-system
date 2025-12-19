import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select, OptionsRenderer } from '../Select';

describe('OptionsRenderer', () => {
  it('renders options', () => {
    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ];

    const { container } = render(
      <select>
        <OptionsRenderer options={options} />
      </select>
    );

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('renders placeholder option when provided', () => {
    const options = [{ value: '1', label: 'Option 1' }];

    render(
      <select>
        <OptionsRenderer options={options} placeholder="Select..." />
      </select>
    );

    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('handles empty value option', () => {
    const options = [{ value: '', label: 'Empty' }];

    render(
      <select>
        <OptionsRenderer options={options} />
      </select>
    );

    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});

describe('Select', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ];

  it('renders select with options', () => {
    render(<Select options={options} />);

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<Select options={options} placeholder="Choose..." />);

    expect(screen.getByText('Choose...')).toBeInTheDocument();
  });

  it('handles value change', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2' } });

    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue('2');
  });

  it('applies custom className', () => {
    const { container } = render(
      <Select options={options} className="custom-class" />
    );

    const select = container.querySelector('select');
    expect(select).toHaveClass('custom-class');
  });

  it('passes through other props', () => {
    render(
      <Select
        options={options}
        name="test-select"
        id="test-id"
        disabled
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('name', 'test-select');
    expect(select).toHaveAttribute('id', 'test-id');
    expect(select).toBeDisabled();
  });
});

