import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BenfordsAnalysis } from '../transactionhistory/components/BenfordsAnalysis';

describe('BenfordsAnalysis', () => {
  const digits = [
    { digit: 1, expected: 30.1, actual: 28.5 },
    { digit: 2, expected: 17.6, actual: 19.2 },
    { digit: 3, expected: 12.5, actual: 11.8 },
  ];

  it('renders title', () => {
    render(<BenfordsAnalysis digits={digits} />);
    expect(screen.getByText("Benford's Law Analysis")).toBeInTheDocument();
  });

  it('renders all digit rows', () => {
    render(<BenfordsAnalysis digits={digits} />);
    expect(screen.getByText('Digit 1')).toBeInTheDocument();
    expect(screen.getByText('Digit 2')).toBeInTheDocument();
    expect(screen.getByText('Digit 3')).toBeInTheDocument();
  });

  it('displays expected and actual values', () => {
    render(<BenfordsAnalysis digits={digits} />);
    expect(screen.getByText('Expected: 30.1%')).toBeInTheDocument();
    expect(screen.getByText('Actual: 28.5%')).toBeInTheDocument();
  });
});
