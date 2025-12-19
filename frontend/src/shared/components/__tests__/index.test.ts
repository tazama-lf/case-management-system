import { describe, it, expect } from 'vitest';
import * as Components from '../index';

describe('shared/components/index', () => {
  it('exports ErrorBoundary', () => {
    expect(Components.ErrorBoundary).toBeDefined();
  });

  it('exports ErrorState', () => {
    expect(Components.ErrorState).toBeDefined();
  });

  it('exports EmptyState', () => {
    expect(Components.EmptyState).toBeDefined();
  });

  it('exports LoadingSpinner', () => {
    expect(Components.LoadingSpinner).toBeDefined();
  });
});

