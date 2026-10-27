import { CopilotController } from '../src/modules/copilot/copilot.controller';
import { CopilotModule, copilotEnabled } from '../src/modules/copilot/copilot.module';
import { FeaturesController } from '../src/modules/copilot/features.controller';

describe('copilot feature toggle', () => {
  it('is on only when COPILOT_ENABLED is exactly "true"', () => {
    expect(copilotEnabled({ COPILOT_ENABLED: 'true' })).toBe(true);
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) expect(copilotEnabled({ COPILOT_ENABLED: v })).toBe(false);
  });

  it('disabled: no copilot controller or provider is registered, only the features endpoint', () => {
    const m = CopilotModule.register(false);
    expect(m.controllers).toEqual([FeaturesController]);
    expect(m.imports).toBeUndefined();
    expect(m.providers).toHaveLength(1);
    expect(new FeaturesController(false).features()).toEqual({ copilot: false });
  });

  it('enabled: controller, services and the features endpoint are registered', () => {
    const m = CopilotModule.register(true);
    expect(m.controllers).toContain(CopilotController);
    expect(m.providers!.length).toBeGreaterThan(3);
    expect(new FeaturesController(true).features()).toEqual({ copilot: true });
  });
});
