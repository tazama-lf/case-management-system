// This file runs BEFORE anything else to set up localStorage for MSW
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

// Set up localStorage BEFORE MSW tries to use it
if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'localStorage', {
    value: new LocalStorageMock(),
    writable: true,
    configurable: true,
  });
}
