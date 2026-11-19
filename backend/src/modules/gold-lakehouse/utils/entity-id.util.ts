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

/**
 * The entity id without the scheme suffix. `conditions.entity_id` holds entity-level conditions under this bare form,
 * while the ids in `transaction_detail` carry the suffix, so comparing the two directly never matched.
 */
export function stripEntityIdSuffix(entityId: string): string {
  return entityId.endsWith(ENTITY_ID_SUFFIX) ? entityId.slice(0, -ENTITY_ID_SUFFIX.length) : entityId;
}
