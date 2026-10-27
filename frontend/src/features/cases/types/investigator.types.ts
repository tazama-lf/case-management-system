export type CaseInvestigatorMembership = 'LEAD' | 'OBSERVER';

export interface CaseInvestigator {
  id: number;
  case_id: number;
  tenant_id: string;
  user_id: string;
  membership: CaseInvestigatorMembership;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  /** The user's role, from the backend's role cache. null/absent = unknown. */
  user_role?: string | null;
}

export interface CaseInvestigatorBlocklistEntry {
  id: number;
  case_id: number;
  tenant_id: string;
  user_id: string;
  blocked_by: string;
  blocked_at: string;
  block_reason: string;
  unblocked_at: string | null;
  unblocked_by: string | null;
  unblock_reason: string | null;
}

/**
 * Who used to have access to a case and lost it (revoked allowlist rows, manual and automatic),
 * and who was blocklisted and later unblocked. Most recent first. Supervisor+ only.
 */
export interface CaseAccessHistory {
  revoked: CaseInvestigator[];
  unblocked: CaseInvestigatorBlocklistEntry[];
}

// No AddCaseInvestigatorDto - there is no allowlist add endpoint at all
// The allowlist is populated exclusively by task assignment
// nobody,including a supervisor, adds to it by hand. "Refuses on blocklist hit"
// now only ever surfaces indirectly, via a refused task assignment, not
// through this file.

export interface RevokeCaseInvestigatorDto {
  reason: string;
}

export interface BlocklistCaseInvestigatorDto {
  userId: string;
  reason: string;
}

export interface UnblockCaseInvestigatorDto {
  reason: string;
}

// Refusal shape when adding a blocklisted user - names who blocked them and
// when, per the design doc's "Refuses on live blocklist hit, naming who
// blocked and when."
export interface BlocklistRefusalError {
  message: string;
  blockedBy?: string;
  blockedAt?: string;
  blockReason?: string;
}
