import { Injectable, Logger } from '@nestjs/common';
import type { AssistantTurn, ChatMessage, ToolChoice, ToolSpec } from './agent/agent.types';
import type { ModelInfo, ServedModel } from './copilot.types';
import { BUILTIN_EMBEDDING, embedBuiltin, normalise } from './embeddings';

const TEMPERATURE = 0.1;

/** A model's reply: the parsed JSON (null when there is none) and the text exactly as it came back. */
export interface ModelReply<T> {
  value: T | null;
  raw: string | null;
}

/**
 * Where the copilot's language model comes from. Three modes, set per deployment:
 *
 *   bundled  (default) the small open-weight model that ships with the CMS, served by the
 *            copilot-llm container (llama.cpp). Case data stays inside the deployment.
 *              COPILOT_BUNDLED_URL      default http://localhost:8091/v1
 *              COPILOT_BUNDLED_MODEL    default qwen3-4b-instruct-2507
 *              COPILOT_BUNDLED_LICENSE  default Apache-2.0 (shown to users; must match the shipped weights)
 *   byok     bring your own key: any OpenAI-compatible endpoint the deployer contracts with
 *            (OpenAI, Azure OpenAI, Groq, a private vLLM...). Case data is sent to that endpoint.
 *              COPILOT_BYOK_URL, COPILOT_BYOK_API_KEY, COPILOT_BYOK_MODEL
 *   off      no model. Every answer is written by code from the facts.
 *
 * Embeddings: COPILOT_EMBEDDINGS=builtin (default; no model needed) or provider (the endpoint's
 * /embeddings with COPILOT_EMBEDDING_MODEL, falling back to builtin if it fails).
 */
@Injectable()
export class ModelProviderService {
  private readonly logger = new Logger(ModelProviderService.name);
  readonly mode: ModelInfo['mode'];
  private readonly url: string | null;
  private readonly key: string | null;
  private readonly model: string | null;
  private readonly license: string | null;
  private readonly embeddingMode: 'builtin' | 'provider';
  private readonly embeddingModel: string | null;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  /** The model id the endpoint reported on its last answer. */
  private lastServed: string | null = null;
  private props: Promise<ServedModel | null> | null = null;

  constructor() {
    const { env } = process;
    const mode = (env.COPILOT_MODE ?? 'bundled').toLowerCase();
    this.mode = mode === 'byok' || mode === 'off' ? mode : 'bundled';
    ({ url: this.url, key: this.key, model: this.model, license: this.license } = endpointFor(this.mode, env));
    this.embeddingMode = env.COPILOT_EMBEDDINGS === 'provider' && this.url ? 'provider' : 'builtin';
    this.embeddingModel = env.COPILOT_EMBEDDING_MODEL ?? null;
    this.timeoutMs = Number(env.COPILOT_TIMEOUT_MS ?? 180_000);
    this.maxTokens = Number(env.COPILOT_MAX_TOKENS ?? 1200);
  }

  info(): ModelInfo {
    return {
      mode: this.mode,
      model: this.model,
      license: this.license,
      endpoint: this.url ? new URL(this.url).host : null,
      dataLeavesDeployment: this.mode === 'byok',
      embeddings: this.embeddingMode === 'provider' && this.embeddingModel ? this.embeddingModel : BUILTIN_EMBEDDING,
    };
  }

  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', ...(this.key ? { authorization: `Bearer ${this.key}` } : {}) };
  }

  async reachable(): Promise<boolean> {
    if (!this.url || !this.model) return false;
    try {
      const r = await fetch(`${this.url}/models`, { headers: this.headers(), signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch {
      return false;
    }
  }

  /** The generation settings every call uses, recorded with each record. */
  settings(): { temperature: number; maxTokens: number } {
    return { temperature: TEMPERATURE, maxTokens: this.maxTokens };
  }

  /**
   * The model the endpoint actually serves. llama.cpp reports the weights file, quantisation and build at /props;
   * a provider reports the resolved model id with each answer. Null with no model.
   */
  async served(): Promise<ServedModel | null> {
    if (!this.url || !this.model) return null;
    if (this.mode === 'bundled') {
      this.props ??= this.readProps();
      const props = await this.props;
      if (props) return props;
      this.props = null; // not answering yet; ask again next time
    }
    return { model: this.lastServed ?? this.model };
  }

  private async readProps(): Promise<ServedModel | null> {
    try {
      const r = await fetch(`${this.url!.replace(/\/v1$/v, '')}/props`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) return null;
      const p = (await r.json()) as { model_alias?: string; model_path?: string; model_ftype?: string; build_info?: string };
      return { model: p.model_alias ?? this.model, file: p.model_path?.split('/').pop(), quantisation: p.model_ftype, build: p.build_info };
    } catch {
      return null;
    }
  }

  /**
   * Ask for a JSON object. `value` is null when there is no model, it fails, or it does not return JSON; `raw` is
   * the reply exactly as it came back, kept with the record for audit.
   */
  async chatJson<T>(system: string, user: string): Promise<ModelReply<T>> {
    if (!this.url || !this.model) return { value: null, raw: null };
    const started = Date.now();
    const body = {
      model: this.model,
      temperature: TEMPERATURE,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    try {
      const r = await fetch(`${this.url}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!r.ok) {
        this.logger.warn(`model returned HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        return { value: null, raw: null };
      }
      const json = (await r.json()) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
      this.lastServed = json.model ?? this.lastServed;
      const content = json.choices?.[0]?.message?.content ?? '';
      this.logger.log(`${this.mode} model ${this.model} answered in ${Date.now() - started} ms`);
      return { value: parseJsonObject(content) as T | null, raw: content };
    } catch (e) {
      this.logger.warn(`model call failed after ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`);
      return { value: null, raw: null };
    }
  }

  /**
   * One turn of a tool-using conversation (OpenAI-compatible `tools`). Returns null when there is no model or it fails.
   * llama.cpp needs --jinja for tool calls; the compose service sets it.
   */
  async chatTurn(messages: ChatMessage[], tools: ToolSpec[], toolChoice: ToolChoice): Promise<AssistantTurn | null> {
    if (!this.url || !this.model) return null;
    const started = Date.now();
    const body = {
      model: this.model,
      temperature: TEMPERATURE,
      max_tokens: this.maxTokens,
      messages,
      ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
    };
    try {
      const r = await fetch(`${this.url}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!r.ok) {
        this.logger.warn(`model returned HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        return null;
      }
      const json = (await r.json()) as { model?: string; choices?: Array<{ message?: ChatMessage }> };
      this.lastServed = json.model ?? this.lastServed;
      const message = json.choices?.[0]?.message;
      if (!message) return null;
      this.logger.log(`${this.mode} model ${this.model} took a turn in ${Date.now() - started} ms`);
      const toolCalls = (message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
      return { content: message.content ?? '', toolCalls, message: { ...message, content: message.content ?? null } };
    } catch (e) {
      this.logger.warn(`model call failed after ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
    if (this.embeddingMode === 'provider' && this.embeddingModel) {
      try {
        const r = await fetch(`${this.url}/embeddings`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: this.embeddingModel, input: texts }),
          signal: AbortSignal.timeout(60_000),
        });
        if (r.ok) {
          const json = (await r.json()) as { data: Array<{ embedding: number[] }> };
          return { vectors: json.data.map((d) => normalise(d.embedding)), model: this.embeddingModel };
        }
        this.logger.warn(`embeddings returned HTTP ${r.status}; using ${BUILTIN_EMBEDDING}`);
      } catch (e) {
        this.logger.warn(`embeddings failed (${e instanceof Error ? e.message : String(e)}); using ${BUILTIN_EMBEDDING}`);
      }
    }
    return { vectors: texts.map(embedBuiltin), model: BUILTIN_EMBEDDING };
  }
}

function endpointFor(
  mode: ModelInfo['mode'],
  env: NodeJS.ProcessEnv,
): { url: string | null; key: string | null; model: string | null; license: string | null } {
  const trim = (u: string): string | null => u.replace(/\/$/v, '') || null;
  if (mode === 'byok') {
    return {
      url: trim(env.COPILOT_BYOK_URL ?? ''),
      key: env.COPILOT_BYOK_API_KEY ?? null,
      model: env.COPILOT_BYOK_MODEL ?? null,
      license: 'Provider terms (bring your own key)',
    };
  }
  if (mode === 'bundled') {
    return {
      url: trim(env.COPILOT_BUNDLED_URL ?? 'http://localhost:8091/v1'),
      key: null,
      model: env.COPILOT_BUNDLED_MODEL ?? 'qwen3-4b-instruct-2507',
      license: env.COPILOT_BUNDLED_LICENSE ?? 'Apache-2.0',
    };
  }
  return { url: null, key: null, model: null, license: null };
}

export function parseJsonObject(content: string): unknown {
  const text = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gv, '').trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const m = /\{[\s\S]*\}/v.exec(text);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as unknown;
    } catch {
      return null;
    }
  }
}
