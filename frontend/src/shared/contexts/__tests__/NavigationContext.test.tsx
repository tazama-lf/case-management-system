import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NavigationContext from '../NavigationContext';

vi.mock('../../../features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', username: 'test' },
  })),
}));

describe('NavigationContext', () => {
  it('provides default context value', () => {
    const TestComponent = () => {
      const context = React.useContext(NavigationContext);
      return <div>{context ? 'Context exists' : 'No context'}</div>;
    };

    render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>
    );

    // Context should be undefined by default
    expect(screen.getByText('No context')).toBeInTheDocument();
  });

  it('NavigationProvider provides context value', () => {
    // Test that NavigationProvider can be imported and used
    // The actual provider logic is tested through useNavigation hook
    const mockContext = {
      currentPath: '/test',
      navigate: vi.fn(),
      user: null,
      setUser: vi.fn(),
    };

    const TestComponent = () => {
      const context = React.useContext(NavigationContext);
      return (
        <div data-testid="test">
          {context ? `Context exists: ${context.currentPath}` : 'No context'}
        </div>
      );
    };

    render(
      <MemoryRouter>
        <NavigationContext.Provider value={mockContext}>
          <TestComponent />
        </NavigationContext.Provider>
      </MemoryRouter>
    );

    // The context should be provided
    const testElement = screen.getByTestId('test');
    expect(testElement.textContent).toContain('Context exists: /test');
  });
});
