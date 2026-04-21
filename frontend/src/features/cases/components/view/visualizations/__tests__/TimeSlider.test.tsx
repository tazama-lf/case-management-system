import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeSlider from '../network-analysis/TimeSlider';

describe('TimeSlider', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const config = {
    range: 'days' as const,
    startDate: past,
    endDate: now,
  };

  it('renders time range buttons', () => {
    render(<TimeSlider config={config} onChange={vi.fn()} />);
    expect(screen.getByText('Minutes')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Weeks')).toBeInTheDocument();
    expect(screen.getByText('Months')).toBeInTheDocument();
  });

  it('calls onChange when range button is clicked', () => {
    const onChange = vi.fn();
    render(<TimeSlider config={config} onChange={onChange} />);
    fireEvent.click(screen.getByText('Hours'));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call.range).toBe('hours');
  });

  it('renders slider input', () => {
    render(<TimeSlider config={config} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });
});
