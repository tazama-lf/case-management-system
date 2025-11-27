import { describe, it, expect } from 'vitest';

import {
  WorkQueueDashboard,
  WorkQueueTable,
  WorkQueueTableSkeleton,
} from '../index';

describe('workqueue index barrel', () => {
  it('should export WorkQueueDashboard', () => {
    expect(WorkQueueDashboard).toBeDefined();
  });

  it('should export WorkQueueTable', () => {
    expect(WorkQueueTable).toBeDefined();
  });

  it('should export WorkQueueTableSkeleton', () => {
    expect(WorkQueueTableSkeleton).toBeDefined();
  });
});


