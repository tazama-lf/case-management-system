import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Notification,
  NotificationContainer,
} from '../Notification';

describe('Notification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success notification', () => {
    render(
      <Notification
        type="success"
        title="Success"
        message="Operation completed"
      />
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('renders error notification', () => {
    render(
      <Notification
        type="error"
        title="Error"
        message="Something went wrong"
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders warning notification', () => {
    render(
      <Notification
        type="warning"
        title="Warning"
        message="Please be careful"
      />
    );

    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Please be careful')).toBeInTheDocument();
  });

  it('renders info notification', () => {
    render(
      <Notification
        type="info"
        title="Info"
        message="Here is some information"
      />
    );

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Here is some information')).toBeInTheDocument();
  });

  it('renders notification without message', () => {
    render(<Notification type="success" title="Success" />);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.queryByText(/message/i)).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Notification
        type="success"
        title="Success"
        onClose={onClose}
      />
    );

    const closeButton = container.querySelector('button[type="button"]');
    expect(closeButton).toBeDefined();
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls action onClick when action button is clicked', () => {
    const actionOnClick = vi.fn();
    render(
      <Notification
        type="success"
        title="Success"
        action={{ label: 'Retry', onClick: actionOnClick }}
      />
    );

    const actionButton = screen.getByText('Retry');
    fireEvent.click(actionButton);

    expect(actionOnClick).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after duration when autoClose is true', () => {
    const onClose = vi.fn();
    render(
      <Notification
        type="success"
        title="Success"
        autoClose={true}
        duration={1000}
        onClose={onClose}
      />
    );

    expect(onClose).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(1000);
    vi.runAllTimers();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close when autoClose is false', async () => {
    const onClose = vi.fn();
    render(
      <Notification
        type="success"
        title="Success"
        autoClose={false}
        duration={1000}
        onClose={onClose}
      />
    );

    vi.advanceTimersByTime(2000);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('NotificationContainer', () => {
  it('returns null when notifications array is empty', () => {
    const { container } = render(
      <NotificationContainer notifications={[]} onRemove={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders multiple notifications', () => {
    const notifications = [
      {
        id: '1',
        type: 'success' as const,
        title: 'Success 1',
      },
      {
        id: '2',
        type: 'error' as const,
        title: 'Error 1',
      },
    ];

    render(
      <NotificationContainer
        notifications={notifications}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Success 1')).toBeInTheDocument();
    expect(screen.getByText('Error 1')).toBeInTheDocument();
  });

  it('calls onRemove when notification is closed', () => {
    const onRemove = vi.fn();
    const notifications = [
      {
        id: '1',
        type: 'success' as const,
        title: 'Success',
      },
    ];

    const { container } = render(
      <NotificationContainer
        notifications={notifications}
        onRemove={onRemove}
      />
    );

    const closeButton = container.querySelector('button[type="button"]');
    expect(closeButton).toBeDefined();
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onRemove).toHaveBeenCalledWith('1');
    }
  });

  it('renders notifications at different positions', () => {
    const notifications = [
      {
        id: '1',
        type: 'success' as const,
        title: 'Success',
      },
    ];

    const positions = [
      'top-right',
      'top-left',
      'bottom-right',
      'bottom-left',
      'top-center',
      'bottom-center',
    ] as const;

    positions.forEach((position) => {
      const { container } = render(
        <NotificationContainer
          notifications={notifications}
          onRemove={vi.fn()}
          position={position}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

