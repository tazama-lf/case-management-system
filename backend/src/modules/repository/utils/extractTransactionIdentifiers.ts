import type { JsonValue } from './types/JsonValue';

export interface TransactionIdentifiers {
  msgId: string | null;
  orgnlEndToEndId: string | null;
  orgnlInstrId: string | null;
  dbtrAcctId: string | null;
  cdtrAcctId: string | null;
}

/**
 * Recursively searches the ISO20022 transaction payload for the first string value
 * keyed by any of `keys`. Field names like MsgId/OrgnlEndToEndId/OrgnlInstrId/EndToEndId/
 * InstrId are unique enough within the message shapes we ingest (pacs.002, pacs.008,
 * pain.001, pain.013) that an unscoped search is safe.
 */
function findFirstKey(obj: JsonValue, keys: string[], maxDepth = 15, currentDepth = 0): string | null {
  if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) {
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findFirstKey(item, keys, maxDepth, currentDepth + 1);
      if (result) return result;
    }
    return null;
  }

  const record = obj as Record<string, JsonValue>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const result = findFirstKey(value, keys, maxDepth, currentDepth + 1);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Account identifiers (Dbtr/CdtrAcct.Id.Othr[].Id) share the bare key "Id" with unrelated
 * party-identity fields (e.g. Cdtr.Id.PrvtId.Othr[].Id), so we first locate the named
 * account container (DbtrAcct/CdtrAcct) and only then search within it for "Id".
 */
function findAcctId(obj: JsonValue, containerKey: string, maxDepth = 15, currentDepth = 0): string | null {
  if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) {
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findAcctId(item, containerKey, maxDepth, currentDepth + 1);
      if (result) return result;
    }
    return null;
  }

  const record = obj as Record<string, JsonValue>;
  const container = record[containerKey];
  if (container && typeof container === 'object') {
    const id = findFirstKey(container, ['Id']);
    if (id) return id;
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const result = findAcctId(value, containerKey, maxDepth, currentDepth + 1);
      if (result) return result;
    }
  }

  return null;
}

export function extractTransactionIdentifiers(transaction: JsonValue): TransactionIdentifiers {
  return {
    msgId: findFirstKey(transaction, ['MsgId']),
    orgnlEndToEndId: findFirstKey(transaction, ['OrgnlEndToEndId', 'EndToEndId']),
    orgnlInstrId: findFirstKey(transaction, ['OrgnlInstrId', 'InstrId']),
    dbtrAcctId: findAcctId(transaction, 'DbtrAcct'),
    cdtrAcctId: findAcctId(transaction, 'CdtrAcct'),
  };
}
