import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../../empty/EmptyState';

describe('EmptyState', () => {
  it('renders with default props', () => {
    render(<EmptyState />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.getByText('There is no data to display at the moment.')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<EmptyState title="Custom Title" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<EmptyState message="Custom message" />);

    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('renders default icon when no icon is provided', () => {
    const { container } = render(<EmptyState />);

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    const CustomIcon = () => <div data-testid="custom-icon">Custom Icon</div>;

    render(<EmptyState icon={<CustomIcon />} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add Item" onAction={onAction} />);

    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is not provided', () => {
    const onAction = vi.fn();
    render(<EmptyState onAction={onAction} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when onAction is not provided', () => {
    render(<EmptyState actionLabel="Add Item" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add Item" onAction={onAction} />);

    const button = screen.getByRole('button', { name: 'Add Item' });
    await user.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState className="custom-class" />);

    const emptyState = container.firstChild;
    expect(emptyState).toHaveClass('custom-class');
  });

  it('renders all props together', () => {
    const onAction = vi.fn();
    const CustomIcon = () => <div data-testid="custom-icon">Icon</div>;

    render(
      <EmptyState
        title="No Items"
        message="Create your first item"
        icon={<CustomIcon />}
        actionLabel="Create Item"
        onAction={onAction}
        className="my-class"
      />
    );

    expect(screen.getByText('No Items')).toBeInTheDocument();
    expect(screen.getByText('Create your first item')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument();
  });
});
