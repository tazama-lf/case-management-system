import { act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import StatsCard from '../StatsCard';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('StatsCard component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and static string value', async () => {
    render(
      <StatsCard
        title="Total Users"
        value="N/A"
        icon={<span data-testid="icon">👤</span>}
        color="blue"
        subtitle="Current month"
      />,
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('Current month')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('animates numeric value to final number', () => {
    render(
      <StatsCard
        title="Revenue"
        value={12345}
        icon={<span data-testid="icon">💰</span>}
        color="green"
      />,
    );
    // Run all timers to complete animation
    act(() => {
      vi.runAllTimers();
    });

    // The formatted number should appear
    expect(screen.getByText(/12,?345/)).toBeInTheDocument();
  });

  it('applies correct color classes based on color prop', async () => {
    const { container } = render(
      <StatsCard
        title="Alerts"
        value={5}
        icon={<span data-testid="icon">⚠️</span>}
        color="yellow"
      />,
    );

    // The outer card should contain the hover background class for yellow
    const card = container.querySelector('div.bg-white');
    expect(card).toHaveClass('hover:bg-yellow-50');

    // The icon wrapper should have the correct background color class
    const iconWrapper = container.querySelector('div.p-3');
    expect(iconWrapper).toHaveClass('bg-yellow-500');
  });
});
