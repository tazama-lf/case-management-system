import type { Fact, FactKind } from '../copilot.types';
import { ToolRegistry, type ToolDefinition } from './tool-registry';

const MAX_LIST = 20;
const MAX_SEARCH = 10;
const DEFAULT_NOTES = 10;
const DEFAULT_HITS = 5;
const MIN_WORD = 3;

const ofKinds = (facts: Fact[], kinds: FactKind[]) => (): Fact[] => facts.filter((f) => kinds.includes(f.kind));

const words = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gv)
      ?.filter((w) => w.length >= MIN_WORD) ?? [],
  );

/** Facts ranked by how many of the query's words they contain. Deterministic, needs no model or embeddings. */
export function searchFacts(facts: Fact[], query: string, limit: number): Fact[] {
  const q = words(query);
  return facts
    .map((f) => ({ f, score: [...words(f.text)].filter((w) => q.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id, undefined, { numeric: true }))
    .slice(0, limit)
    .map((x) => x.f);
}

/**
 * Read-only tools over the facts that code computed for one case. Each returns a slice of those facts, with the
 * ids they already have, so whatever the model writes can be checked against exactly what a tool returned.
 */
export function factTools(facts: Fact[]): ToolRegistry {
  const tools: ToolDefinition[] = [
    {
      name: 'get_alert_and_rules',
      description: 'The case, the Tazama alert (typology score and thresholds) and the rules that fired. Call this first.',
      parameters: {},
      run: ofKinds(facts, ['case', 'alert', 'rule']),
    },
    {
      name: 'get_subject_profile',
      description: 'Who the subject of the case is, their KYC profile and screening results, where they exist.',
      parameters: {},
      run: ofKinds(facts, ['subject', 'kyc', 'screening']),
    },
    {
      name: 'get_transaction_activity',
      description:
        'The alert transaction, account activity in the recent window against earlier months, and patterns code found in the payments (pass-through, structuring, night-time, distance from usual locations).',
      parameters: {},
      run: ofKinds(facts, ['transaction', 'activity', 'pattern']),
    },
    {
      name: 'get_counterparties',
      description: 'The main counterparties in the activity window, and which of them are new.',
      parameters: {},
      run: ofKinds(facts, ['counterparty']),
    },
    {
      name: 'get_notes_and_comments',
      description:
        'What investigators and supervisors wrote on the case: triage findings, extracts from bank systems such as device and login logs, and progress. Often the strongest evidence. Newest last.',
      parameters: { limit: { type: 'integer', description: `How many to return, 1 to ${MAX_LIST}`, min: 1, max: MAX_LIST } },
      run: (args) => ofKinds(facts, ['note'])().slice(0, Number(args.limit ?? DEFAULT_NOTES)),
    },
    {
      name: 'search_facts',
      description: 'Find facts that mention given words, for example "device", "refund" or a counterparty name.',
      parameters: {
        query: { type: 'string', description: 'Words to look for', maxLength: 200, required: true },
        limit: { type: 'integer', description: `How many to return, 1 to ${MAX_SEARCH}`, min: 1, max: MAX_SEARCH },
      },
      run: (args) => searchFacts(facts, String(args.query), Number(args.limit ?? DEFAULT_HITS)),
    },
  ];
  return new ToolRegistry(tools);
}
