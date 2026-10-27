import { type DynamicModule, Module, type Provider, type Type } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseInvestigatorModule } from '../case-investigator/case-investigator.module';
import { CaseFactsService } from './case-facts.service';
import { CaseReadAccessGuard } from './case-read-access.guard';
import { COPILOT_FEATURES, type CopilotFeatures, anyCopilotFeature, copilotFeatures, strategyName } from './copilot.config';
import { CopilotStatusController, FeaturesController } from './copilot-status.controller';
import { InvestigationController } from './investigation.controller';
import { InvestigationService } from './investigation.service';
import { AgentStrategy, INVESTIGATION_STRATEGY, PipelineStrategy } from './investigation.strategy';
import { ModelProviderService } from './model-provider.service';
import { RecordStore } from './record-store.service';
import { SarController } from './sar.controller';
import { SarService } from './sar.service';

/**
 * Investigation copilot (COPILOT_INVESTIGATION_ENABLED) and SAR/STR drafting agent (COPILOT_SAR_ENABLED), each its own
 * feature. Only what is switched on is registered: a feature that is off has no controller, so its routes answer 404.
 * The parts both share (facts, model, record store, investigation service) load when either is on, because a SAR draft is
 * written from the investigation record. Only the small features endpoint is always there, so the UI can ask what is on.
 *
 *   investigation  facts computed by code from CMS data -> embedded -> findings written and checked -> stored
 *   ask            question -> the facts that answer it -> answer written and checked
 *   sar-draft      stored record -> facts per STR section -> narrative written and checked -> goAML XML
 *   sar-review     maker-checker approval of the draft before it can be filed
 */
@Module({})
export class CopilotModule {
  static register(features: CopilotFeatures = copilotFeatures()): DynamicModule {
    const always = {
      module: CopilotModule,
      controllers: [FeaturesController],
      providers: [{ provide: COPILOT_FEATURES, useValue: features }],
    };
    if (!anyCopilotFeature(features)) return always;
    const controllers: Array<Type<unknown>> = [
      ...always.controllers,
      CopilotStatusController,
      ...(features.investigation ? [InvestigationController] : []),
      ...(features.sar ? [SarController] : []),
    ];
    const providers: Provider[] = [
      ...always.providers,
      RecordStore,
      CaseFactsService,
      ModelProviderService,
      CaseReadAccessGuard,
      PipelineStrategy,
      AgentStrategy,
      {
        provide: INVESTIGATION_STRATEGY,
        useFactory: (pipeline: PipelineStrategy, agent: AgentStrategy) => (strategyName() === 'agent' ? agent : pipeline),
        inject: [PipelineStrategy, AgentStrategy],
      },
      InvestigationService,
      ...(features.sar ? [SarService] : []),
    ];
    return {
      module: CopilotModule,
      imports: [PrismaModule, CaseInvestigatorModule],
      controllers,
      providers,
      exports: [InvestigationService],
    };
  }
}
