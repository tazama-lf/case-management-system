/**
 * Attachment entries in an evidence or report CouchDB document carry two fields that exist for the backend only:
 * `filePath` (where the attachment sits in CouchDB) and `encryption` (what the backend needs to decrypt it).
 * Downloads are always looked up by document id and file name and decrypted on the server, so no client needs either.
 */
const INTERNAL_ATTACHMENT_FIELDS: ReadonlySet<string> = new Set(['filePath', 'encryption']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Copy of `value` with `filePath` and `encryption` removed at every depth (attachment lists, nested `documents`,
 * report `history`). Only arrays and plain objects are walked; dates and other values pass through. The input is not
 * modified, so a stored document can be sanitized for a response without touching what is persisted.
 */
export function stripInternalAttachmentFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripInternalAttachmentFields(item)) as T;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !INTERNAL_ATTACHMENT_FIELDS.has(key))
        .map(([key, item]) => [key, stripInternalAttachmentFields(item)]),
    ) as T;
  }
  return value;
}
