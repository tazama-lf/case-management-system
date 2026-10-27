import { Injectable } from '@nestjs/common';
import { runAgent } from './agent/agent-loop';
import { factTools } from './agent/fact-tools';
import { type AgentLimits, type StrategyName, agentLimits } from './copilot.config';
import type { AgentTrace, Fact } from './copilot.types';
import { ModelProviderService, parseJsonObject } from './model-provider.service';
import { ASK_PROMPT, INVESTIGATE_PROMPT, agentAskPrompt, agentInvestigatePrompt, factLines } from './prompts';

/** What a strategy hands back: the model's reply (or null), the facts its sentences may cite, and how it got there. */
export interface Written {
  reply: Record<string, unknown> | null;
  /** The facts the verifier checks the model's sentences against. */
  evidence: Fact[];
  agent?: AgentTrace;
}

/** How the model gets at the case facts. The checks, storage and fallback around it are the same for every strategy. */
export interface InvestigationStrategy {
  readonly name: StrategyName;
  investigate: (facts: Fact[]) => Promise<Written>;
  /** `closest` is the facts nearest the question by embedding; a strategy may use it or read the facts itself. */
  answer: (question: string, facts: Fact[], closest: Fact[]) => Promise<Written>;
}

export const INVESTIGATION_STRATEGY = 'INVESTIGATION_STRATEGY';

/** The model is given all the facts, or the closest ones, in a single prompt. One model call. */
@Injectable()
export class PipelineStrategy implements InvestigationStrategy {
  readonly name = 'pipeline' as const;

  constructor(private readonly models: ModelProviderService) {}

  async investigate(facts: Fact[]): Promise<Written> {
    return {
      reply: await this.models.chatJson<Record<string, unknown>>(INVESTIGATE_PROMPT, `Case facts:\n${factLines(facts)}`),
      evidence: facts,
    };
  }

  async answer(question: string, facts: Fact[], closest: Fact[]): Promise<Written> {
    const reply = await this.models.chatJson<Record<string, unknown>>(
      ASK_PROMPT,
      `Question: ${question}\n\nCase facts:\n${factLines(closest)}`,
    );
    return { reply, evidence: facts };
  }
}

/**
 * The model chooses which facts to read, with read-only tools, then writes. Its sentences may cite only what the
 * tools returned. If it does not use the tools or fails, the pipeline strategy writes instead, and the trace says so.
 */
@Injectable()
export class AgentStrategy implements InvestigationStrategy {
  readonly name = 'agent' as const;
  private readonly limits: AgentLimits = agentLimits();

  constructor(
    private readonly models: ModelProviderService,
    private readonly pipeline: PipelineStrategy,
  ) {}

  async investigate(facts: Fact[]): Promise<Written> {
    return await this.run(
      facts,
      agentInvestigatePrompt(this.limits.maxToolCalls),
      'Investigate this case.',
      async () => await this.pipeline.investigate(facts),
    );
  }

  async answer(question: string, facts: Fact[], closest: Fact[]): Promise<Written> {
    return await this.run(
      facts,
      agentAskPrompt(this.limits.maxToolCalls),
      `Question: ${question}`,
      async () => await this.pipeline.answer(question, facts, closest),
    );
  }

  private async run(facts: Fact[], system: string, user: string, fallback: () => Promise<Written>): Promise<Written> {
    const registry = factTools(facts);
    const result = await runAgent(async (m, t, c) => await this.models.chatTurn(m, t, c), registry, { system, user, limits: this.limits });
    const reply = result.final ? (parseJsonObject(result.final) as Record<string, unknown> | null) : null;
    const trace = { stopped: result.stopped, calls: result.trace, factIds: result.ledger };
    if (reply && result.ledger.length) return { reply, evidence: registry.ledger(), agent: { ...trace, fellBack: false } };
    const written = await fallback();
    return { ...written, agent: { ...trace, fellBack: true } };
  }
}
