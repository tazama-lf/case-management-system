/**
 * Built-in text embedder: feature hashing of word unigrams and bigrams into a fixed-size,
 * L2-normalised vector. It needs no model, gives the same vector for the same text on every
 * deployment, and is good enough to rank a case's few dozen facts against a section query.
 * A deployment can switch to model embeddings (COPILOT_EMBEDDINGS=provider) without changing callers.
 */
export const BUILTIN_EMBEDDING = 'builtin-hash-512';
const DIMS = 512;

const STOP = new Set([
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'and',
  'or',
  'for',
  'with',
  'by',
  'at',
  'from',
  'is',
  'was',
  'were',
  'be',
  'this',
  'that',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s\-]/gv, ' ')
    .split(/\s+/v)
    .map((t) => t.replace(/^[\-.]+|[\-.]+$/gv, ''))
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d[\d,.]*$/v.test(t));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embedBuiltin(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  const t = tokens(text);
  const grams = [...t, ...t.slice(1).map((w, i) => `${t[i]} ${w}`)];
  for (const g of grams) {
    const h = hash(g);
    v[h % DIMS] += h & 0x80000000 ? -1 : 1;
  }
  return normalise(v);
}

export function normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) s += a[i] * b[i];
  return s;
}

/** Ids of the `k` items most similar to the query, best first. */
export function topK(query: number[], vectors: Record<string, number[]>, k: number): string[] {
  return Object.entries(vectors)
    .map(([id, v]) => ({ id, score: cosine(query, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.id);
}
