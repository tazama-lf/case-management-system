import { Module, type DynamicModule } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseFactsService } from './case-facts.service';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { FeaturesController } from './features.controller';
import { ModelProviderService } from './model-provider.service';

/** The copilot is a feature toggle: COPILOT_ENABLED=true registers it, anything else leaves it out entirely. */
export function copilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.COPILOT_ENABLED === 'true';
}

/**
 * Investigation copilot and SAR/STR drafting.
 *
 *   investigation  facts computed by code from CMS data -> embedded -> findings written and checked -> stored
 *   ask            question -> nearest stored facts -> answer written and checked
 *   sar-draft      stored record -> facts retrieved per STR section -> narrative written and checked -> goAML XML
 *   sar-review     maker-checker approval of the draft before it can be filed
 *
 * When disabled, no copilot controller, service or provider exists: its routes answer 404 and nothing is loaded.
 * Only the small features endpoint stays, so the UI can ask which optional features are on.
 */
@Module({})
export class CopilotModule {
  static register(enabled: boolean = copilotEnabled()): DynamicModule {
    if (!enabled) {
      return { module: CopilotModule, controllers: [FeaturesController], providers: [{ provide: 'COPILOT_ENABLED', useValue: false }] };
    }
    return {
      module: CopilotModule,
      imports: [PrismaModule],
      controllers: [CopilotController, FeaturesController],
      providers: [CopilotService, CaseFactsService, ModelProviderService, { provide: 'COPILOT_ENABLED', useValue: true }],
      exports: [CopilotService],
    };
  }
}
