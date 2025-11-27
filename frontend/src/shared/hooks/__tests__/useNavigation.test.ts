import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigation } from '../useNavigation';
import NavigationContext from '../../contexts/NavigationContext';

describe('useNavigation', () => {
  it('returns navigation context value', () => {
    const mockContext = {
      currentPath: '/test',
      navigate: vi.fn(),
      user: null,
      setUser: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(NavigationContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useNavigation(), { wrapper });

    expect(result.current.currentPath).toBe('/test');
    expect(result.current.navigate).toBe(mockContext.navigate);
  });

  it('throws error when used outside NavigationProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useNavigation());
    }).toThrow('useNavigation must be used within a NavigationProvider');

    consoleSpy.mockRestore();
  });
});

