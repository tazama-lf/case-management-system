import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsCard from '../StatsCard';

describe('StatsCard', () => {
  it('renders the provided title, value, and icon', () => {
    render(
      <StatsCard
        title="Active Queues"
        value={12}
        color="blue"
        icon={<span data-testid="stats-icon">★</span>}
      />,
    );

    expect(screen.getByText('Active Queues')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    const iconWrapper = screen.getByTestId('stats-icon').parentElement;
    expect(iconWrapper?.className).toContain('bg-blue-500');
    expect(iconWrapper?.className).toContain('text-white');
  });
});

