import { describe, it, expect } from 'vitest';
import * as AdminExports from '../index';

describe('admin barrel exports', () => {
  it('exports DashboardSection', () => {
    expect(AdminExports.DashboardSection).toBeDefined();
  });

  it('exports WorkQueueManagement', () => {
    expect(AdminExports.WorkQueueManagement).toBeDefined();
  });

  it('exports AdminDashboard', () => {
    expect(AdminExports.AdminDashboard).toBeDefined();
  });
});
