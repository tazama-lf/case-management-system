// Types for the case-level access-control list (ACL) — plan §2/§6
// (docs/case-acl-design.md, .claude/plans/wild-dreaming-dewdrop.md).
// Mirrors the backend's CaseInvestigator / CaseInvestigatorBlacklist shape.

export type CaseInvestigatorMembership = 'LEAD' | 'OBSERVER';

export interface CaseInvestigator {
  id: number;
  case_id: number;
  user_id: string;
  membership: CaseInvestigatorMembership;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface CaseInvestigatorBlacklistEntry {
  id: number;
  case_id: number;
  user_id: string;
  blocked_by: string;
  blocked_at: string;
  block_reason: string;
  unblocked_at: string | null;
  unblocked_by: string | null;
  unblock_reason: string | null;
}

// No AddCaseInvestigatorDto — there is no whitelist add endpoint at all
// (plan §2/§6). The whitelist is populated exclusively by task assignment
// and case ownership (plan §3); nobody, including a supervisor, adds to it
// by hand. "Refuses on blacklist hit" now only ever surfaces indirectly, via
// a refused task assignment or ownership change, not through this file.

export interface RevokeCaseInvestigatorDto {
  reason: string;
}

export interface BlacklistCaseInvestigatorDto {
  userId: string;
  reason: string;
}

export interface UnblockCaseInvestigatorDto {
  reason: string;
}

// Refusal shape when adding a blacklisted user — names who blocked them and
// when, per the design doc's "Refuses on live blacklist hit, naming who
// blocked and when."
export interface BlacklistRefusalError {
  message: string;
  blockedBy?: string;
  blockedAt?: string;
  blockReason?: string;
}
