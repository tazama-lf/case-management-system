import { describe, it, expect } from 'vitest';
import * as AdminExports from '../index';

describe('admin barrel exports', () => {
  it('exports AdminDashboard', () => {
    expect(AdminExports.AdminDashboard).toBeDefined();
  });
});
