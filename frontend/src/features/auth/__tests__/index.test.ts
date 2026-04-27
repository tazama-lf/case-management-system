import { describe, it, expect } from 'vitest';

// Test that all exports from index.ts are available
describe('auth/index.ts exports', () => {
  it('exports ProtectedRoute component', async () => {
    const module = await import('../index');
    expect(module.ProtectedRoute).toBeDefined();
  }, 15000);

  it('exports AuthProvider and useAuth', async () => {
    const module = await import('../index');
    expect(module.AuthProvider).toBeDefined();
    expect(module.useAuth).toBeDefined();
  }, 15000);

  it('exports auth types', async () => {
    const module = await import('../index');
    // Types are compile-time only, but we can verify the module loads
    expect(module).toBeDefined();
  }, 15000);

  it('exports authService', async () => {
    const module = await import('../index');
    expect(module.authService).toBeDefined();
  }, 15000);

  it('exports Login page component', async () => {
    const module = await import('../index');
    expect(module.Login).toBeDefined();
  }, 15000);
});
