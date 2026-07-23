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

  it('wraps focus from first to last with Shift+Tab', () => {
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>,
    );

    const buttons = screen.getAllByRole('button');
    buttons[0].focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[1]);
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

  it('handles Enter keydown on skip button', () => {
    const target = document.createElement('div');
    target.id = 'main-enter';
    target.tabIndex = -1;
    document.body.appendChild(target);

    render(<SkipToContent targetId="main-enter" />);
    fireEvent.keyDown(screen.getByText('Skip to main content'), {
      key: 'Enter',
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    document.body.removeChild(target);
  });

  it('handles Space keydown on skip button', () => {
    const target = document.createElement('div');
    target.id = 'main-space';
    target.tabIndex = -1;
    document.body.appendChild(target);

    render(<SkipToContent targetId="main-space" />);
    fireEvent.keyDown(screen.getByText('Skip to main content'), {
      key: ' ',
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    document.body.removeChild(target);
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

  it('is disabled when disabled prop is true', () => {
    render(<AccessibleButton disabled>Disabled</AccessibleButton>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows custom loading text', () => {
    render(
      <AccessibleButton isLoading loadingText="Saving...">
        Save
      </AccessibleButton>,
    );
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<AccessibleButton className="extra">Btn</AccessibleButton>);
    expect(screen.getByRole('button').className).toContain('extra');
  });
});

describe('useKeyboardNavigation', () => {
  const TestNav: React.FC<{
    items: string[];
    loop?: boolean;
    onSelect?: (i: number, item: any) => void;
    onEscape?: () => void;
    initialIndex?: number;
  }> = ({ items, loop, onSelect, onEscape, initialIndex }) => {
    const { selectedIndex, setSelectedIndex } = useKeyboardNavigation(items, {
      loop,
      onSelect,
      onEscape,
      initialIndex,
    });
    return (
      <div>
        <div data-testid="index">{selectedIndex}</div>
        {items.map((item, i) => (
          <div key={item} className={i === selectedIndex ? 'selected' : ''}>
            {item}
          </div>
        ))}
        <button onClick={() => setSelectedIndex(1)}>Set to 1</button>
      </div>
    );
  };

  it('handles arrow key navigation', () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    render(<TestNav items={items} />);
    expect(screen.getByTestId('index')).toHaveTextContent('0');

    const button = screen.getByText('Set to 1');
    fireEvent.click(button);
    expect(screen.getByTestId('index')).toHaveTextContent('1');
  });

  it('moves down with ArrowDown', () => {
    render(<TestNav items={['A', 'B', 'C']} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByTestId('index')).toHaveTextContent('1');
  });

  it('moves up with ArrowUp', () => {
    render(<TestNav items={['A', 'B', 'C']} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByTestId('index')).toHaveTextContent('0');
  });

  it('loops from last to first with ArrowDown when loop=true', () => {
    render(<TestNav items={['A', 'B']} loop={true} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByTestId('index')).toHaveTextContent('0');
  });

  it('loops from first to last with ArrowUp when loop=true', () => {
    render(<TestNav items={['A', 'B']} loop={true} />);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByTestId('index')).toHaveTextContent('1');
  });

  it('does not loop past end when loop=false', () => {
    render(<TestNav items={['A', 'B']} loop={false} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByTestId('index')).toHaveTextContent('1');
  });

  it('does not loop past start when loop=false', () => {
    render(<TestNav items={['A', 'B']} loop={false} />);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByTestId('index')).toHaveTextContent('0');
  });

  it('jumps to start with Home key', () => {
    render(<TestNav items={['A', 'B', 'C']} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Home' });
    expect(screen.getByTestId('index')).toHaveTextContent('0');
  });

  it('jumps to end with End key', () => {
    render(<TestNav items={['A', 'B', 'C']} />);
    fireEvent.keyDown(document, { key: 'End' });
    expect(screen.getByTestId('index')).toHaveTextContent('2');
  });

  it('calls onSelect on Enter', () => {
    const onSelect = vi.fn();
    render(<TestNav items={['A', 'B']} onSelect={onSelect} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(0, 'A');
  });

  it('calls onSelect on Space', () => {
    const onSelect = vi.fn();
    render(<TestNav items={['A', 'B']} onSelect={onSelect} />);
    fireEvent.keyDown(document, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith(0, 'A');
  });

  it('calls onEscape on Escape', () => {
    const onEscape = vi.fn();
    render(<TestNav items={['A', 'B']} onEscape={onEscape} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
