export const ENTITY_ID_SUFFIX = 'TAZAMA_EID';

/**
 *
 * Entity ids taken from `transaction_detail` (and so from the entity-metadata endpoint) already end in the suffix, while
 * a bare id does not. Appending it unconditionally turned `<id>TAZAMA_EID` into `<id>TAZAMA_EIDTAZAMA_EID`, which matches
 * nothing, so an entity with accounts looked like one with none. Add it only when it is missing.
 */
export function toAccountHolderSource(entityId: string): string {
  return entityId.endsWith(ENTITY_ID_SUFFIX) ? entityId : `${entityId}${ENTITY_ID_SUFFIX}`;
}
