import type { AgentLimits } from '../copilot.config';

/** A tool call as the model asked for it. */
export interface ToolCall {
  id: string;
  name: string;
  /** The raw JSON text the model produced for the arguments. */
  arguments: string;
}

/** A message in the conversation with the model, in the OpenAI-compatible shape llama.cpp and most providers accept. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/** One model turn: text, or a request for tools. */
export interface AssistantTurn {
  content: string;
  toolCalls: ToolCall[];
  message: ChatMessage;
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}

export type ToolChoice = 'auto' | 'none';

/** One model call. Returns null when there is no model, or it failed. */
export type ChatFn = (messages: ChatMessage[], tools: ToolSpec[], toolChoice: ToolChoice) => Promise<AssistantTurn | null>;

/** What happened on one tool call, kept in the stored record as the audit trail of how the answer was produced. */
export interface ToolTrace {
  step: number;
  tool: string;
  arguments: unknown;
  ok: boolean;
  factIds: string[];
  error?: string;
  /** True when the model repeated an earlier identical call and was shown the result again without re-running. */
  repeated?: boolean;
  ms: number;
}

export type StopReason = 'answered' | 'step_limit' | 'tool_limit' | 'timeout' | 'model_failed';

export interface AgentResult {
  /** The model's final text, or null when it never produced one. */
  final: string | null;
  trace: ToolTrace[];
  /** Ids of every fact a tool returned during the run. Only these may be cited. */
  ledger: string[];
  stopped: StopReason;
}

export interface AgentInput {
  system: string;
  user: string;
  limits: AgentLimits;
}
