import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="No Data Found" />);

    expect(screen.getByText('No Data Found')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(
      <EmptyState
        title="No Data"
        description="There are no items to display at this time."
      />,
    );

    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(
      screen.getByText('There are no items to display at this time.'),
    ).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(<EmptyState title="No Data" />);

    const description = container.querySelector('.text-gray-500');
    expect(description).not.toBeInTheDocument();
  });

  it('should render default document icon', () => {
    const { container } = render(<EmptyState title="No Data" />);

    // DocumentIcon should be rendered by default
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('h-12', 'w-12', 'text-gray-400');
  });

  it('should render folder icon when specified', () => {
    const { container } = render(<EmptyState title="No Data" icon="folder" />);

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should render exclamation icon when specified', () => {
    const { container } = render(
      <EmptyState title="No Data" icon="exclamation" />,
    );

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should render custom React element as icon', () => {
    const CustomIcon = () => <div data-testid="custom-icon">Custom</div>;

    render(<EmptyState title="No Data" icon={<CustomIcon />} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const action = {
      label: 'Add Item',
      onClick: vi.fn(),
    };

    render(<EmptyState title="No Data" action={action} />);

    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toBeInTheDocument();
  });

  it('should call action onClick when button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const action = {
      label: 'Add Item',
      onClick,
    };

    render(<EmptyState title="No Data" action={action} />);

    const button = screen.getByRole('button', { name: 'Add Item' });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when not provided', () => {
    render(<EmptyState title="No Data" />);

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  it('should render primary button variant by default', () => {
    const action = {
      label: 'Add Item',
      onClick: vi.fn(),
    };

    render(<EmptyState title="No Data" action={action} />);

    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
  });

  it('should render secondary button variant when specified', () => {
    const action = {
      label: 'Add Item',
      onClick: vi.fn(),
      variant: 'secondary' as const,
    };

    render(<EmptyState title="No Data" action={action} />);

    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toHaveClass('bg-white', 'hover:bg-gray-50');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <EmptyState title="No Data" className="custom-class" />,
    );

    const emptyStateContainer = container.querySelector('.text-center');
    expect(emptyStateContainer).toHaveClass('custom-class');
  });

  it('should have proper structure and styling', () => {
    const { container } = render(
      <EmptyState
        title="No Data"
        description="Description text"
        action={{ label: 'Action', onClick: vi.fn() }}
      />,
    );

    // Check for main container
    const mainContainer = container.querySelector('.text-center');
    expect(mainContainer).toHaveClass('py-12');

    // Check for title styling
    const title = screen.getByText('No Data');
    expect(title).toHaveClass('text-lg', 'font-medium', 'text-gray-900');

    // Check for description styling
    const description = screen.getByText('Description text');
    expect(description).toHaveClass('text-sm', 'text-gray-500');
  });

  it('should render complete empty state with all props', () => {
    const onClick = vi.fn();

    render(
      <EmptyState
        title="No Cases Found"
        description="Create your first case to get started"
        icon="folder"
        action={{
          label: 'Create Case',
          onClick,
          variant: 'primary',
        }}
        className="my-custom-class"
      />,
    );

    expect(screen.getByText('No Cases Found')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first case to get started'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create Case' }),
    ).toBeInTheDocument();
  });
});
