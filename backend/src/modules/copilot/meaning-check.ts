import { Injectable } from '@nestjs/common';
import type { CheckedSentence, CheckedText, Fact } from './copilot.types';
import { ModelProviderService } from './model-provider.service';
import { MEANING_PROMPT } from './prompts';

const MAX_REASON = 200;

interface Verdict {
  n?: number;
  supported?: boolean;
  reason?: string;
}

/**
 * A second reading of the model's text, switched on with COPILOT_MEANING_CHECK=true. The code checks catch wrong
 * numbers and invented names; this one asks the model whether each cited sentence says what its facts say (it catches
 * "a 1.0 times increase" or a reversed direction), and removes those that do not. It costs one more model call per
 * text, and a small model can miss things, so it adds to the code checks and never replaces them. If the call fails
 * the text keeps the result of the code checks.
 */
@Injectable()
export class MeaningCheck {
  readonly enabled = process.env.COPILOT_MEANING_CHECK === 'true';

  constructor(private readonly models: ModelProviderService) {}

  async review(text: CheckedText | null, facts: Fact[]): Promise<CheckedText | null> {
    if (!this.enabled || text?.writtenBy !== 'model') return text;
    const judged = text.sentences.filter((s) => s.cites.length);
    if (!judged.length) return text;
    const byId = new Map(facts.map((f) => [f.id, f.text]));
    const lines = judged.map(
      (s, i) => `${i + 1}. ${s.text}\n   Cited facts: ${s.cites.map((c) => `${c}: ${byId.get(c) ?? ''}`).join(' | ')}`,
    );
    const { value } = await this.models.chatJson<{ verdicts?: Verdict[] }>(MEANING_PROMPT, lines.join('\n'));
    if (!Array.isArray(value?.verdicts)) return text;
    const unsupported = new Map(
      value.verdicts
        .filter((v) => v.supported === false && Number.isInteger(v.n) && v.n! >= 1 && v.n! <= judged.length)
        .map((v) => [judged[v.n! - 1], (typeof v.reason === 'string' ? v.reason : 'no reason given').slice(0, MAX_REASON)]),
    );
    if (!unsupported.size) return text;
    const removed: CheckedSentence[] = [...unsupported].map(([s, why]) => ({
      ...s,
      ok: false,
      reasons: [`the meaning check found the cited facts do not say this: ${why}`],
    }));
    return { ...text, sentences: text.sentences.filter((s) => !unsupported.has(s)), removed: [...text.removed, ...removed] };
  }
}
