import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NetworkLegend from '../network-analysis/NetworkLegend';
import type { LegendItem } from '../network-analysis/NetworkLegend';

describe('NetworkLegend', () => {
  const items: LegendItem[] = [
    {
      color: '#EF4444',
      label: 'Alert Triggered',
      type: 'circle',
      ringColor: '#EF4444',
    },
    { color: '#6366F1', label: 'Normal Account', type: 'circle' },
    {
      color: '#F472B6',
      label: 'Outbound Flow',
      type: 'line',
      lineStyle: 'dashed',
      hasArrow: true,
    },
  ];

  it('renders legend title', () => {
    render(<NetworkLegend items={items} />);
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });

  it('renders all legend labels', () => {
    render(<NetworkLegend items={items} />);
    expect(screen.getByText('Alert Triggered')).toBeInTheDocument();
    expect(screen.getByText('Normal Account')).toBeInTheDocument();
    expect(screen.getByText('Outbound Flow')).toBeInTheDocument();
  });

  it('renders correct number of items', () => {
    const { container } = render(<NetworkLegend items={items} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(items.length);
  });
});
