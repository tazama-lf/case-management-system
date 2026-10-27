import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TazamaAuthGuard } from '../src/guards/tazama-auth.guard';
import { CaseReadAccessGuard } from '../src/modules/copilot/case-read-access.guard';
import { FeaturesController } from '../src/modules/copilot/copilot-status.controller';
import { CopilotModule } from '../src/modules/copilot/copilot.module';
import { InvestigationController } from '../src/modules/copilot/investigation.controller';
import { SarController } from '../src/modules/copilot/sar.controller';

const controllers = (m: ReturnType<typeof CopilotModule.register>): unknown[] => m.controllers ?? [];

describe('CopilotModule.register', () => {
  it('registers only the features endpoint when both features are off', () => {
    const m = CopilotModule.register({ investigation: false, sar: false });
    expect(controllers(m)).toEqual([FeaturesController]);
    expect(m.imports).toBeUndefined();
    expect(new FeaturesController({ investigation: false, sar: false }).list()).toEqual({ copilotInvestigation: false, copilotSar: false });
  });

  it('registers the investigation controller alone, without the SAR one', () => {
    const c = controllers(CopilotModule.register({ investigation: true, sar: false }));
    expect(c).toContain(InvestigationController);
    expect(c).not.toContain(SarController);
  });

  it('registers the SAR controller alone, with the shared parts it needs but no investigation routes', () => {
    const m = CopilotModule.register({ investigation: false, sar: true });
    expect(controllers(m)).toContain(SarController);
    expect(controllers(m)).not.toContain(InvestigationController);
    expect(m.providers).toContain(CaseReadAccessGuard);
  });

  it('registers both when both are on', () => {
    const c = controllers(CopilotModule.register({ investigation: true, sar: true }));
    expect(c).toEqual(expect.arrayContaining([InvestigationController, SarController]));
  });

  it('puts every copilot endpoint behind the login guard', () => {
    for (const c of controllers(CopilotModule.register({ investigation: true, sar: true }))) {
      expect(Reflect.getMetadata(GUARDS_METADATA, c as object)).toContain(TazamaAuthGuard);
    }
  });
});
