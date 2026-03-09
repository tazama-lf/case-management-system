import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DashboardSection from '../DashboardSection';

describe('DashboardSection', () => {
  it('renders dashboard section with title and subtitle', () => {
    render(
      <DashboardSection title="Test Title" subtitle="Test Subtitle">
        <div>Test Content</div>
      </DashboardSection>,
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders view all link when provided', () => {
    render(
      <DashboardSection
        title="Test Title"
        subtitle="Test Subtitle"
        viewAllHref="/test"
      >
        <div>Test Content</div>
      </DashboardSection>,
    );

    const viewAllLink = screen.getByText('View all');
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute('href', '/test');
  });

  it('does not render view all link when not provided', () => {
    render(
      <DashboardSection title="Test Title" subtitle="Test Subtitle">
        <div>Test Content</div>
      </DashboardSection>,
    );

    expect(screen.queryByText('View all')).not.toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <DashboardSection title="Test Title" subtitle="Test Subtitle">
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </DashboardSection>,
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
});
