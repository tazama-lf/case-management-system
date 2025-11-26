import { describe, it, expect } from 'vitest';

describe('modals/components/index', () => {
  it('exports all components', async () => {
    const module = await import('../index');

    expect(module.CaseInformationCard).toBeDefined();
    expect(module.PersonInformationCard).toBeDefined();
    expect(module.BlockAllowListStatus).toBeDefined();
    expect(module.RecentActivitySection).toBeDefined();
    expect(module.ModalHeader).toBeDefined();
  });
});

