import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// Improved localStorage mock for MSW cookie store
class LocalStorageMock implements Storage {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

// Set up localStorage before anything else
Object.defineProperty(global, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
});

// Enable MSW
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { },
    removeListener: () => { },
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => { },
  }),
});

class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];

  constructor() { }
  disconnect() { }
  observe() { }
  unobserve() { }
  takeRecords() {
    return [];
  }
}

global.IntersectionObserver = MockIntersectionObserver as any;

class MockResizeObserver {
  constructor() { }
  disconnect() { }
  observe() { }
  unobserve() { }
}

global.ResizeObserver = MockResizeObserver as any;
