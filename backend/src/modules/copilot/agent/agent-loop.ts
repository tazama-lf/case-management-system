import type { AgentInput, AgentResult, AssistantTurn, ChatFn, ChatMessage, StopReason, ToolCall, ToolTrace } from './agent.types';
import type { ToolRegistry } from './tool-registry';

/** Most tool calls run from a single model turn; the rest are answered "not run" so one turn cannot burn the budget. */
const MAX_CALLS_PER_TURN = 4;

const argumentsOf = (call: ToolCall): unknown => {
  try {
    return JSON.parse(call.arguments || '{}');
  } catch {
    return call.arguments;
  }
};

/** Same tool and same arguments, whatever order the keys came in. */
const canonical = (call: ToolCall): string => {
  const args = argumentsOf(call);
  const sorted =
    typeof args === 'object' && args !== null ? Object.fromEntries(Object.entries(args).sort(([x], [y]) => x.localeCompare(y))) : args;
  return `${call.name}:${JSON.stringify(sorted)}`;
};

/** One run of a tool-using model, with the state that must not leak between runs. */
class AgentRun {
  private readonly messages: ChatMessage[];
  private readonly trace: ToolTrace[] = [];
  private readonly results = new Map<string, string>();
  private readonly deadline: number;
  private calls = 0;

  constructor(
    private readonly chat: ChatFn,
    private readonly registry: ToolRegistry,
    private readonly input: AgentInput,
    private readonly now: () => number,
  ) {
    this.deadline = now() + input.limits.timeoutMs;
    this.messages = [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ];
  }

  /** Why the model must answer now instead of calling more tools, or null when it may keep going. */
  private mustAnswer(step: number): StopReason | null {
    if (this.calls >= this.input.limits.maxToolCalls) return 'tool_limit';
    if (this.now() >= this.deadline) return 'timeout';
    return step === this.input.limits.maxSteps ? 'step_limit' : null;
  }

  async run(): Promise<AgentResult> {
    const specs = this.registry.specs();
    let reason: StopReason = 'step_limit';
    for (let step = 1; step <= this.input.limits.maxSteps; step += 1) {
      const forced = this.mustAnswer(step);
      if (forced) reason = forced;
      // eslint-disable-next-line no-await-in-loop -- each turn depends on the tool results of the one before
      const turn = await this.chat(this.messages, forced ? [] : specs, forced ? 'none' : 'auto');
      if (!turn) return this.finish(null, 'model_failed');
      if (!turn.toolCalls.length || forced) return this.finish(turn.content || null, turn.content ? 'answered' : reason);
      this.useTools(turn, step);
    }
    return this.finish(null, reason);
  }

  /** Every call gets a reply, run or not: OpenAI-compatible providers reject a conversation with an unanswered call. */
  private useTools(turn: AssistantTurn, step: number): void {
    this.messages.push(turn.message);
    turn.toolCalls.forEach((call, index) => {
      const started = this.now();
      const skipped = this.skipReason(index);
      const { text, entry } = skipped
        ? { text: `Not run: ${skipped}.`, entry: { ok: false, factIds: [], error: skipped } }
        : this.execute(call);
      this.messages.push({ role: 'tool', tool_call_id: call.id, content: text });
      this.trace.push({ step, tool: call.name, arguments: argumentsOf(call), ...entry, ms: this.now() - started });
    });
  }

  /** Why a call is not run: the cap per turn, or the run's tool-call budget is spent. */
  private skipReason(index: number): string | null {
    if (index >= MAX_CALLS_PER_TURN) return `at most ${MAX_CALLS_PER_TURN} tool calls per turn`;
    if (this.calls >= this.input.limits.maxToolCalls) return 'the tool-call limit for this run is reached';
    return null;
  }

  /** Runs a call through the registry, or replays the earlier result when the model repeats itself. */
  private execute(call: ToolCall): { text: string; entry: Pick<ToolTrace, 'ok' | 'factIds' | 'error' | 'repeated'> } {
    const key = canonical(call);
    const earlier = this.results.get(key);
    if (earlier !== undefined) return { text: earlier, entry: { ok: true, factIds: [], repeated: true } };
    this.calls += 1;
    const out = this.registry.invoke(call.name, call.arguments);
    const text = out.ok ? out.text : `Error: ${out.error}`;
    this.results.set(key, text);
    return { text, entry: out.ok ? { ok: true, factIds: out.facts.map((f) => f.id) } : { ok: false, factIds: [], error: out.error } };
  }

  private finish(final: string | null, stopped: StopReason): AgentResult {
    return { final, trace: this.trace, ledger: this.registry.ledger().map((f) => f.id), stopped };
  }
}

/**
 * Runs a tool-using model until it answers, with hard limits so it always ends: a cap on model turns, on tool
 * calls and on time. When a limit is reached the model is asked once more with tools switched off so it writes its
 * answer from what it has. The loop never executes anything the registry did not declare, repeats an identical
 * call without re-running it, and records every call in the trace.
 */
export async function runAgent(
  chat: ChatFn,
  registry: ToolRegistry,
  input: AgentInput,
  now: () => number = Date.now,
): Promise<AgentResult> {
  return await new AgentRun(chat, registry, input, now).run();
}
