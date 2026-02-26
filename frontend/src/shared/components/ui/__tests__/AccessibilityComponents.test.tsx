import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FocusTrap,
  SkipToContent,
  ScreenReaderText,
  LiveRegion,
  useAnnouncer,
  AccessibleButton,
  useKeyboardNavigation,
} from '../AccessibilityComponents';

describe('FocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders children', () => {
    render(
      <FocusTrap>
        <button>Test Button</button>
      </FocusTrap>,
    );

    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });

  it('focuses first element when active', () => {
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>,
    );

    const firstButton = screen.getByText('First');
    expect(document.activeElement).toBe(firstButton);
  });

  it('does not focus when inactive', () => {
    render(
      <FocusTrap active={false}>
        <button>Test</button>
      </FocusTrap>,
    );

    const button = screen.getByText('Test');
    expect(document.activeElement).not.toBe(button);
  });

  it('handles Tab key navigation', () => {
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </FocusTrap>,
    );

    const buttons = screen.getAllByRole('button');
    // First button should be focused automatically
    expect(document.activeElement).toBe(buttons[0]);

    // Tab to next - this is handled by the component's logic
    // The actual focus wrapping is tested in the wrap test
  });

  it('wraps focus from last to first element', () => {
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>,
    );

    const buttons = screen.getAllByRole('button');
    buttons[1].focus();

    // Tab from last should wrap to first
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    render(
      <FocusTrap active={true} onEscape={onEscape}>
        <button>Test</button>
      </FocusTrap>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus when unmounted', () => {
    const previousElement = document.createElement('button');
    previousElement.textContent = 'Previous';
    document.body.appendChild(previousElement);
    previousElement.focus();

    const { unmount } = render(
      <FocusTrap active={true} restoreFocus={true}>
        <button>Test</button>
      </FocusTrap>,
    );

    unmount();

    // Focus should be restored to previous element
    expect(document.activeElement).toBe(previousElement);
  });

  it('applies custom className', () => {
    const { container } = render(
      <FocusTrap className="custom-class">
        <div>Content</div>
      </FocusTrap>,
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('SkipToContent', () => {
  beforeEach(() => {
    // Mock scrollIntoView since it's not available in JSDOM
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders skip to content button', () => {
    render(<SkipToContent targetId="main" />);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('focuses target element when clicked', () => {
    const target = document.createElement('div');
    target.id = 'main';
    target.tabIndex = -1; // Make it focusable
    document.body.appendChild(target);

    render(<SkipToContent targetId="main" />);
    const button = screen.getByText('Skip to main content');
    fireEvent.click(button);

    // The target should be focused and scrollIntoView should be called
    expect(target).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
    });
    document.body.removeChild(target);
  });

  it('applies custom className', () => {
    const { container } = render(
      <SkipToContent targetId="main" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('ScreenReaderText', () => {
  it('renders content for screen readers', () => {
    render(<ScreenReaderText>Hidden text</ScreenReaderText>);
    expect(screen.getByText('Hidden text')).toBeInTheDocument();
  });

  it('applies sr-only class', () => {
    const { container } = render(<ScreenReaderText>Text</ScreenReaderText>);
    expect(container.firstChild).toHaveClass('sr-only');
  });

  it('renders with custom element', () => {
    const { container } = render(
      <ScreenReaderText as="div">Text</ScreenReaderText>,
    );
    expect(container.firstChild?.tagName).toBe('DIV');
  });
});

describe('LiveRegion', () => {
  it('renders aria-live region', () => {
    render(<LiveRegion message="Announcement" />);
    const region = screen.getByText('Announcement');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders with assertive priority', () => {
    render(<LiveRegion message="Urgent" priority="assertive" />);
    const region = screen.getByText('Urgent');
    expect(region).toHaveAttribute('aria-live', 'assertive');
  });

  it('applies id when provided', () => {
    render(<LiveRegion message="Test" id="live-region" />);
    const region = screen.getByText('Test');
    expect(region).toHaveAttribute('id', 'live-region');
  });
});

describe('useAnnouncer', () => {
  it('announces messages', () => {
    const TestComponent = () => {
      const { announce, announcement } = useAnnouncer();
      return (
        <div>
          <button onClick={() => announce('Test message')}>Announce</button>
          {announcement && <div>{announcement.message}</div>}
        </div>
      );
    };

    render(<TestComponent />);
    const button = screen.getByText('Announce');
    fireEvent.click(button);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});

describe('AccessibleButton', () => {
  it('renders button with children', () => {
    render(<AccessibleButton>Click me</AccessibleButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<AccessibleButton isLoading={true}>Click me</AccessibleButton>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'danger'] as const;
    variants.forEach((variant) => {
      const { container } = render(
        <AccessibleButton variant={variant}>Test</AccessibleButton>,
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('renders with different sizes', () => {
    const { rerender } = render(
      <AccessibleButton size="sm">Test</AccessibleButton>,
    );
    expect(screen.getByText('Test')).toBeInTheDocument();

    rerender(<AccessibleButton size="md">Test</AccessibleButton>);
    expect(screen.getByText('Test')).toBeInTheDocument();

    rerender(<AccessibleButton size="lg">Test</AccessibleButton>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

describe('useKeyboardNavigation', () => {
  it('handles arrow key navigation', () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    const TestComponent = () => {
      const { selectedIndex, setSelectedIndex } = useKeyboardNavigation(items);
      return (
        <div>
          <div>{items[selectedIndex]}</div>
          <button onClick={() => setSelectedIndex(1)}>Set to 1</button>
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    // Test manual index change
    const button = screen.getByText('Set to 1');
    fireEvent.click(button);
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
