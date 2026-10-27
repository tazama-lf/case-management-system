import type { StrategyName } from './copilot.config';
import type { Provenance } from './copilot.types';
import type { ModelProviderService } from './model-provider.service';
import { PROMPT_VERSION } from './prompts';

/** Exactly what produced a record: prompt version, strategy, settings, whether the meaning check ran, and the model served. */
export async function provenanceOf(models: ModelProviderService, strategy: StrategyName, meaningCheck: boolean): Promise<Provenance> {
  return { promptVersion: PROMPT_VERSION, strategy, ...models.settings(), meaningCheck, served: await models.served() };
}
