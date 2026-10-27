/** Which copilot features a deployment has switched on, and how the investigation is produced. All read from the environment. */
export interface CopilotFeatures {
  /** The investigation copilot: summary, red flags, next steps and the case chat. */
  investigation: boolean;
  /** The SAR/STR drafting agent and its review workflow. */
  sar: boolean;
}

export type StrategyName = 'pipeline' | 'agent';

export interface AgentLimits {
  /** Most model turns in one run. */
  maxSteps: number;
  /** Most tool calls in one run. */
  maxToolCalls: number;
  /** Wall-clock budget for the whole run. */
  timeoutMs: number;
}

/** DI token for the resolved feature flags. */
export const COPILOT_FEATURES = 'COPILOT_FEATURES';

const ON = 'true';
const DEFAULT_MAX_STEPS = 6;
const DEFAULT_MAX_TOOL_CALLS = 8;
const DEFAULT_AGENT_TIMEOUT_MS = 240_000;

/** A feature is on only when its variable is exactly "true"; anything else, including unset, is off. */
export function copilotFeatures(env: NodeJS.ProcessEnv = process.env): CopilotFeatures {
  return { investigation: env.COPILOT_INVESTIGATION_ENABLED === ON, sar: env.COPILOT_SAR_ENABLED === ON };
}

export const anyCopilotFeature = (f: CopilotFeatures): boolean => f.investigation || f.sar;

/** pipeline (default): the model reads all facts in one prompt. agent: it chooses which facts to read with tools. */
export function strategyName(env: NodeJS.ProcessEnv = process.env): StrategyName {
  return env.COPILOT_STRATEGY === 'agent' ? 'agent' : 'pipeline';
}

export function agentLimits(env: NodeJS.ProcessEnv = process.env): AgentLimits {
  const positive = (value: string | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    maxSteps: positive(env.COPILOT_AGENT_MAX_STEPS, DEFAULT_MAX_STEPS),
    maxToolCalls: positive(env.COPILOT_AGENT_MAX_TOOL_CALLS, DEFAULT_MAX_TOOL_CALLS),
    timeoutMs: positive(env.COPILOT_AGENT_TIMEOUT_MS, DEFAULT_AGENT_TIMEOUT_MS),
  };
}
