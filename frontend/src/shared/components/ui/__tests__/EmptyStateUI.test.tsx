import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmptyState from '../EmptyState';

describe('EmptyState (ui)', () => {
  it('renders with title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adding some items" />);
    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Try adding some items')).not.toBeInTheDocument();
  });

  it('renders default document icon when icon="document"', () => {
    const { container } = render(<EmptyState title="Empty" icon="document" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders folder icon', () => {
    const { container } = render(<EmptyState title="Empty" icon="folder" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders exclamation icon', () => {
    const { container } = render(
      <EmptyState title="Empty" icon="exclamation" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders custom React element as icon', () => {
    const customIcon = <span data-testid="custom-icon">★</span>;
    render(<EmptyState title="Empty" icon={customIcon} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button with primary variant by default', () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Empty" action={{ label: 'Add Item', onClick }} />,
    );
    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-blue-600');
  });

  it('renders action button with secondary variant', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Go Back', onClick, variant: 'secondary' }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Go Back' });
    expect(button.className).toContain('bg-white');
  });

  it('calls onClick when action button is clicked', () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Empty" action={{ label: 'Click me', onClick }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState title="Empty" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not render button when no action provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
