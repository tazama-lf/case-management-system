import React, { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
  onEscape?: () => void;
  className?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  restoreFocus = true,
  onEscape,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const getFocusableElements = () => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
      ].join(', ');

      return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    };

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];

    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (!active || e.key !== 'Tab') return;

      const currentFocusableElements = getFocusableElements();
      const currentFirstElement = currentFocusableElements[0];
      const currentLastElement = currentFocusableElements[currentFocusableElements.length - 1];

      if (!currentFirstElement) return;

      if (e.shiftKey) {
        if (document.activeElement === currentFirstElement) {
          e.preventDefault();
          currentLastElement?.focus();
        }
      } else {
        if (document.activeElement === currentLastElement) {
          e.preventDefault();
          currentFirstElement.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);

      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, onEscape, restoreFocus]);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
};

interface SkipToContentProps {
  targetId: string;
  className?: string;
}

export const SkipToContent: React.FC<SkipToContentProps> = ({
  targetId,
  className = '',
}) => {
  const handleSkip = () => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={handleSkip}
      className={`
        fixed top-0 left-0 z-50 px-4 py-2 bg-blue-600 text-white
        transform -translate-y-full focus:translate-y-0 transition-transform
        ${className}
      `}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSkip();
        }
      }}
    >
      Skip to main content
    </button>
  );
};

interface ScreenReaderTextProps {
  children: ReactNode;
  as?: 'span' | 'div' | 'p';
}

export const ScreenReaderText: React.FC<ScreenReaderTextProps> = ({
  children,
  as: Component = 'span',
}) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

interface AnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
  id?: string;
}

export const LiveRegion: React.FC<AnnouncementProps> = ({
  message,
  priority = 'polite',
  id,
}) => {
  return (
    <div
      id={id}
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

export const useAnnouncer = () => {
  const [announcement, setAnnouncement] = React.useState<{
    message: string;
    priority: 'polite' | 'assertive';
  } | null>(null);

  const announce = React.useCallback((
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    setAnnouncement({ message, priority });
    setTimeout(() => setAnnouncement(null), 1000);
  }, []);

  return {
    announce,
    announcement,
  };
};

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  isLoading = false,
  loadingText = 'Loading...',
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? (
        <>
          <span aria-hidden="true" className="inline-block w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {loadingText}
          <ScreenReaderText>Loading, please wait</ScreenReaderText>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export const useKeyboardNavigation = (
  items: any[],
  options: {
    initialIndex?: number;
    loop?: boolean;
    onSelect?: (index: number, item: any) => void;
    onEscape?: () => void;
  } = {}
) => {
  const {
    initialIndex = 0,
    loop = true,
    onSelect,
    onEscape,
  } = options;

  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex);

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev + 1;
          if (next >= items.length) {
            return loop ? 0 : prev;
          }
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev - 1;
          if (next < 0) {
            return loop ? items.length - 1 : prev;
          }
          return next;
        });
        break;

      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onSelect) {
          onSelect(selectedIndex, items[selectedIndex]);
        }
        break;

      case 'Escape':
        if (onEscape) {
          onEscape();
        }
        break;
    }
  }, [items, selectedIndex, loop, onSelect, onEscape]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    selectedIndex,
    setSelectedIndex,
  };
};
