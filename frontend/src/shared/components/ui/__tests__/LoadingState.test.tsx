import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  LoadingState,
  LoadingOverlay,
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  ListSkeleton,
} from '../LoadingState';

describe('LoadingState', () => {
  it('renders children when not loading, no error, and not empty', () => {
    render(
      <LoadingState>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <LoadingState loading={true}>
        <div>Content</div>
      </LoadingState>
    );

    // SpinnerWithText renders "Loading..." text - there may be multiple instances
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
  });

  it('renders custom loading component', () => {
    render(
      <LoadingState
        loading={true}
        loadingComponent={<div>Custom Loading</div>}
      >
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Custom Loading')).toBeInTheDocument();
  });

  it('renders error state with string error', () => {
    render(
      <LoadingState error="Something went wrong">
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders error state with Error object', () => {
    render(
      <LoadingState error={new Error('Test error')}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('renders custom error component', () => {
    render(
      <LoadingState
        error="Error"
        errorComponent={<div>Custom Error</div>}
      >
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <LoadingState empty={true}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('No Data Available')).toBeInTheDocument();
    expect(screen.getByText("There's nothing to display right now.")).toBeInTheDocument();
  });

  it('renders custom empty component', () => {
    render(
      <LoadingState
        empty={true}
        emptyComponent={<div>Custom Empty</div>}
      >
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Custom Empty')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <LoadingState className="custom-class">
        <div>Content</div>
      </LoadingState>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('LoadingOverlay', () => {
  it('renders children when not loading', () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div>Content</div>
      </LoadingOverlay>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders loading overlay when loading', () => {
    const { container } = render(
      <LoadingOverlay isLoading={true}>
        <div>Content</div>
      </LoadingOverlay>
    );

    // Loading overlay should be present
    const overlay = container.querySelector('.absolute.inset-0');
    expect(overlay).toBeInTheDocument();
    // There may be multiple "Loading..." texts
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
  });

  it('renders custom loading text', () => {
    render(
      <LoadingOverlay isLoading={true} text="Please wait...">
        <div>Content</div>
      </LoadingOverlay>
    );

    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders without overlay background', () => {
    const { container } = render(
      <LoadingOverlay isLoading={true} overlay={false}>
        <div>Content</div>
      </LoadingOverlay>
    );

    const overlay = container.querySelector('.bg-white.bg-opacity-75');
    expect(overlay).not.toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders skeleton with animation', () => {
    const { container } = render(<Skeleton className="h-4 w-4" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('renders skeleton without animation', () => {
    const { container } = render(<Skeleton animate={false} />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).not.toHaveClass('animate-pulse');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('custom-class');
  });
});

describe('TableSkeleton', () => {
  it('renders table skeleton with default rows and columns', () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll('.bg-gray-200');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders table skeleton with custom rows and columns', () => {
    const { container } = render(<TableSkeleton rows={3} columns={2} />);
    const skeletons = container.querySelectorAll('.bg-gray-200');
    expect(skeletons.length).toBe(8); // Header row (2) + 3 data rows (6)
  });
});

describe('CardSkeleton', () => {
  it('renders card skeleton', () => {
    const { container } = render(<CardSkeleton />);
    const card = container.querySelector('.bg-white.border');
    expect(card).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardSkeleton className="custom-class" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-class');
  });
});

describe('ListSkeleton', () => {
  it('renders list skeleton with default items', () => {
    const { container } = render(<ListSkeleton />);
    const skeletons = container.querySelectorAll('.bg-gray-200');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders list skeleton with custom items count', () => {
    const { container } = render(<ListSkeleton items={3} />);
    const skeletons = container.querySelectorAll('.bg-gray-200');
    expect(skeletons.length).toBe(9); // 3 items * 3 skeletons each
  });
});

