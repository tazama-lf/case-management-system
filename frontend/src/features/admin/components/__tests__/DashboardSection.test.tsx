import { render, screen } from '@testing-library/react';
import DashboardSection from '../DashboardSection';
import { describe, it, expect, vi } from 'vitest';

describe('DashboardSection', () => {
  it('should render the title and children', () => {
    render(
      <DashboardSection title="Test Section" subtitle="Test Subtitle">
        <div>Test Child</div>
      </DashboardSection>,
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should render the "View all" link when viewAllHref is provided', () => {
    render(
      <DashboardSection
        title="Test Section"
        subtitle="Test Subtitle"
        viewAllHref="/test"
      >
        <div>Test Child</div>
      </DashboardSection>,
    );

    expect(screen.getByText('View all')).toBeInTheDocument();
    expect(screen.getByText('View all')).toHaveAttribute('href', '/test');
  });
});
