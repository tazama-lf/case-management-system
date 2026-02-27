import type { JsonValue } from './types/JsonValue';

export function extractReferenceId(obj: JsonValue, maxDepth = 10, currentDepth = 0, referenceIdName: string): string | null {
  if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) {
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = extractReferenceId(item, maxDepth, currentDepth + 1, referenceIdName);
      if (result) {
        return result;
      }
    }
    return null;
  }

  const objAsRecord = obj as Record<string, JsonValue>;

  for (const [key, value] of Object.entries(objAsRecord)) {
    if (key === referenceIdName) {
      if (typeof value === 'string') return value;
      return value ? String(value) : null;
    }
  }

  for (const [, value] of Object.entries(objAsRecord)) {
    if (value && typeof value === 'object') {
      const result = extractReferenceId(value, maxDepth, currentDepth + 1, referenceIdName);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
