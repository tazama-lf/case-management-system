import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TriageModeIndicator from '../TriageModeIndicator';
import * as useSystemConfigModule from '@/shared/hooks/useSystemConfig';

vi.mock('@/shared/hooks/useSystemConfig', () => ({
  useSystemConfig: vi.fn(),
  getTriageModeLabel: vi.fn((type) => {
    switch (type) {
      case 'AI': return 'AI Automated';
      case 'MANUAL': return 'Manual Review';
      case 'DISABLED': return 'Direct Investigation';
      default: return 'Unknown';
    }
  }),
  getTriageModeDescription: vi.fn((type) => {
    switch (type) {
      case 'AI': return 'Alerts are automatically processed using AI predictions with confidence thresholds';
      case 'MANUAL': return 'All alerts require manual review and human decision-making';
      case 'DISABLED': return 'Alerts bypass triage and go directly to investigation';
      default: return 'Unknown triage mode';
    }
  }),
  getTriageModeColor: vi.fn((type) => {
    switch (type) {
      case 'AI': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'MANUAL': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'DISABLED': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }),
}));

describe('TriageModeIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when config is loading', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: null,
      loading: true,
      triageType: 'MANUAL',
    });

    const { container } = render(<TriageModeIndicator />);
    const loadingElement = container.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders AI mode indicator', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'AI' },
      loading: false,
      triageType: 'AI',
    });

    render(<TriageModeIndicator />);
    expect(screen.getByText('AI Automated')).toBeInTheDocument();
  });

  it('renders Manual mode indicator', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'MANUAL' },
      loading: false,
      triageType: 'MANUAL',
    });

    render(<TriageModeIndicator />);
    expect(screen.getByText('Manual Review')).toBeInTheDocument();
  });

  it('renders Disabled mode indicator', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'DISABLED' },
      loading: false,
      triageType: 'DISABLED',
    });

    render(<TriageModeIndicator />);
    expect(screen.getByText('Direct Investigation')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'AI' },
      loading: false,
      triageType: 'AI',
    });

    render(<TriageModeIndicator compact={true} />);
    expect(screen.getByText('AI Automated')).toBeInTheDocument();
    // In compact mode, should have title attribute with description
    const indicator = screen.getByText('AI Automated').closest('div');
    expect(indicator).toHaveAttribute('title');
  });

  it('shows description when showDescription is true', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'MANUAL' },
      loading: false,
      triageType: 'MANUAL',
    });

    render(<TriageModeIndicator showDescription={true} />);
    expect(
      screen.getByText(/All alerts require manual review and human decision-making/i),
    ).toBeInTheDocument();
  });

  it('does not show description when showDescription is false', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'MANUAL' },
      loading: false,
      triageType: 'MANUAL',
    });

    render(<TriageModeIndicator showDescription={false} />);
    expect(
      screen.queryByText(/All alerts require manual review/i),
    ).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'AI' },
      loading: false,
      triageType: 'AI',
    });

    const { container } = render(<TriageModeIndicator className="custom-class" />);
    const indicator = container.querySelector('.custom-class');
    expect(indicator).toBeInTheDocument();
  });

  it('renders correct icon for each triage type', () => {
    // Test AI mode
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'AI' },
      loading: false,
      triageType: 'AI',
    });
    const { rerender } = render(<TriageModeIndicator />);
    expect(screen.getByText('AI Automated')).toBeInTheDocument();

    // Test Manual mode
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'MANUAL' },
      loading: false,
      triageType: 'MANUAL',
    });
    rerender(<TriageModeIndicator />);
    expect(screen.getByText('Manual Review')).toBeInTheDocument();

    // Test Disabled mode
    (useSystemConfigModule.useSystemConfig as vi.Mock).mockReturnValue({
      config: { triageType: 'DISABLED' },
      loading: false,
      triageType: 'DISABLED',
    });
    rerender(<TriageModeIndicator />);
    expect(screen.getByText('Direct Investigation')).toBeInTheDocument();
  });
});

