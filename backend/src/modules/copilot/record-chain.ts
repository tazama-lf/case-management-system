import { createHash } from 'node:crypto';

/** The fields of a copilot record that its hash covers: everything but the database id. */
export interface ChainedFields {
  caseId: number;
  tenantId: string;
  kind: string;
  parentId: number | null;
  createdBy: string;
  provider: string;
  model: string | null;
  embeddingModel: string | null;
  payload: unknown;
  createdAt: string;
  prevHash: string | null;
}

/** JSON with object keys sorted at every level, so the same content always gives the same text whatever order JSONB returns. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 of the record together with the previous record's hash: changing or removing any record breaks every later link. */
export const recordHash = (fields: ChainedFields): string => createHash('sha256').update(canonical(fields)).digest('hex');
