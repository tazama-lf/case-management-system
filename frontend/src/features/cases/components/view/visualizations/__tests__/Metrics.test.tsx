import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Metrics } from '../alertnavigator/components/Metrics';

describe('Metrics', () => {
  it('renders all metric values', () => {
    render(<Metrics typologiesCount={5} rulesCount={12} averageScore={78} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('renders metric labels', () => {
    render(<Metrics typologiesCount={3} rulesCount={7} averageScore={60} />);
    expect(screen.getByText('Typologies Triggered')).toBeInTheDocument();
    expect(screen.getByText('Rules Extracted')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    render(<Metrics typologiesCount={0} rulesCount={0} averageScore={0} />);
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
