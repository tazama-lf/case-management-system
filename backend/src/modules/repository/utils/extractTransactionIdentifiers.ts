import type { JsonValue } from './types/JsonValue';

export interface TransactionIdentifiers {
  msgId: string | null;
  orgnlEndToEndId: string | null;
  orgnlInstrId: string | null;
  dbtrAcctId: string | null;
  cdtrAcctId: string | null;
}

/**
 * Recursively searches the transaction payload for the first string value keyed by
 * any of `keys`. MsgId/OrgnlEndToEndId/OrgnlInstrId live under FIToFIPmtSts.GrpHdr /
 * TxInfAndSts, and dbtrAcctId/cdtrAcctId live flat on the rule/typology engine's
 * DataCache enrichment object (see @tazama-lf/frms-coe-lib's DataCache interface) -
 * these field names are unique enough in the payload that an unscoped recursive
 * search is safe and doesn't need the exact container path hardcoded.
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

export function extractTransactionIdentifiers(transaction: JsonValue): TransactionIdentifiers {
  return {
    msgId: findFirstKey(transaction, ['MsgId']),
    orgnlEndToEndId: findFirstKey(transaction, ['OrgnlEndToEndId', 'EndToEndId']),
    orgnlInstrId: findFirstKey(transaction, ['OrgnlInstrId', 'InstrId']),
    dbtrAcctId: findFirstKey(transaction, ['dbtrAcctId']),
    cdtrAcctId: findFirstKey(transaction, ['cdtrAcctId']),
  };
}
