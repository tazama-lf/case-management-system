import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TypologyList } from '../alertnavigator/components/TypologyList';

describe('TypologyList', () => {
  const typologies = [
    { name: 'Money Laundering', score: 90 },
    { name: 'Fraud', score: 65 },
    { name: 'Tax Evasion', score: 40 },
  ];

  it('renders all typology names', () => {
    render(
      <TypologyList typologies={typologies} expandedIndex={null} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Money Laundering')).toBeInTheDocument();
    expect(screen.getByText('Fraud')).toBeInTheDocument();
    expect(screen.getByText('Tax Evasion')).toBeInTheDocument();
  });

  it('displays scores', () => {
    render(
      <TypologyList typologies={typologies} expandedIndex={null} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      <TypologyList typologies={typologies} expandedIndex={null} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByText('Money Laundering'));
    expect(onToggle).toHaveBeenCalledWith(0);
  });
});
