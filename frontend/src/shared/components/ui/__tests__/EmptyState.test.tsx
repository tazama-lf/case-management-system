import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EmptyState from '../EmptyState';

describe('EmptyState (ui)', () => {
  it('renders title', () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="T" description="Some desc" />);
    expect(screen.getByText('Some desc')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    const { container } = render(<EmptyState title="T" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('renders default document icon when icon is omitted', () => {
    const { container } = render(<EmptyState title="T" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders folder icon', () => {
    const { container } = render(<EmptyState title="T" icon="folder" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders exclamation icon', () => {
    const { container } = render(<EmptyState title="T" icon="exclamation" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders custom React element icon', () => {
    const Custom = () => <span data-testid="custom-icon">!</span>;
    render(<EmptyState title="T" icon={<Custom />} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button (primary variant)', () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="T" action={{ label: 'Add', onClick, variant: 'primary' }} />,
    );
    const btn = screen.getByRole('button', { name: 'Add' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-blue-600');
  });

  it('renders action button (secondary variant)', () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="T" action={{ label: 'Cancel', onClick, variant: 'secondary' }} />,
    );
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.className).toContain('border-gray-300');
  });

  it('calls action.onClick when button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="T" action={{ label: 'Go', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when action is not provided', () => {
    render(<EmptyState title="T" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="T" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
