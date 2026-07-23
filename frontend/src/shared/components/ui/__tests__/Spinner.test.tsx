import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Spinner,
  DotsSpinner,
  PulseSpinner,
  SpinnerWithText,
} from '../Spinner';

describe('Spinner', () => {
  it('renders spinner with default props', () => {
    const { container } = render(<Spinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveAttribute('role', 'status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders spinner with different sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach((size) => {
      const { container } = render(<Spinner size={size} />);
      const spinner = container.firstChild as HTMLElement;
      expect(spinner).toBeInTheDocument();
    });
  });

  it('renders spinner with different colors', () => {
    const colors = ['primary', 'secondary', 'white', 'gray'] as const;

    colors.forEach((color) => {
      const { container } = render(<Spinner color={color} />);
      const spinner = container.firstChild as HTMLElement;
      expect(spinner).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(<Spinner className="custom-class" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass('custom-class');
  });
});

describe('DotsSpinner', () => {
  it('renders dots spinner', () => {
    const { container } = render(<DotsSpinner />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });

  it('renders with different sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      const { container } = render(<DotsSpinner size={size} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('renders with different colors', () => {
    const colors = ['primary', 'secondary', 'white', 'gray'] as const;

    colors.forEach((color) => {
      const { container } = render(<DotsSpinner color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe('PulseSpinner', () => {
  it('renders pulse spinner', () => {
    const { container } = render(<PulseSpinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass('animate-pulse');
  });

  it('renders with different sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      const { container } = render(<PulseSpinner size={size} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('renders with different colors', () => {
    const colors = ['primary', 'secondary', 'white', 'gray'] as const;

    colors.forEach((color) => {
      const { container } = render(<PulseSpinner color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe('SpinnerWithText', () => {
  it('renders spinner with default text', () => {
    const { container } = render(<SpinnerWithText />);
    // There may be multiple "Loading..." texts (from spinner and text)
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
    // Verify spinner is rendered (it's a child element)
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('renders spinner with custom text', () => {
    render(<SpinnerWithText text="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders with different spinner types', () => {
    const types = ['spinner', 'dots', 'pulse'] as const;

    types.forEach((type) => {
      const { container } = render(<SpinnerWithText spinnerType={type} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('renders with different sizes', () => {
    const { rerender } = render(
      <SpinnerWithText size="sm" text="Loading sm" />,
    );
    expect(screen.getByText('Loading sm')).toBeInTheDocument();

    rerender(<SpinnerWithText size="md" text="Loading md" />);
    expect(screen.getByText('Loading md')).toBeInTheDocument();

    rerender(<SpinnerWithText size="lg" text="Loading lg" />);
    expect(screen.getByText('Loading lg')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SpinnerWithText className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
