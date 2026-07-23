import { describe, it, expect } from 'vitest';

describe('cases/types/index', () => {
  it('exports evidence types', async () => {
    const module = await import('../index');

    // Verify that the module exports something
    expect(module).toBeDefined();
  }, 15000);
});
