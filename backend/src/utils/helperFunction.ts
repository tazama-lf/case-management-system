import type { AuthenticatedRequest } from './types/auth.types';
import { CaseStatus } from '@prisma/client-cms';
import type { IUserData } from './interfaces/IUserData';

export function extractUserData(req: AuthenticatedRequest): IUserData {
  const { clientId, tenantId, claims, email, fullName } = req.user.token;
  const bearerToken = req.headers.authorization!.replace('Bearer ', '');
  // if (!clientId || !tenantId || !claims) {
  //   throw new Error('Missing clientId, tenantId or claims in auth token');
  // }

  const role = claims.includes('CMS_SUPERVISOR') ? 'SUPERVISOR' : 'INVESTIGATOR';
  const validateClaim = claims.includes('CMS_SUPERVISOR') ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
  const userClaims = req.user.token.claims;
  const isComplianceOfficer = userClaims.includes('CMS_COMPLIANCE_OFFICER');

  return {
    userId: clientId,
    tenantId,
    email,
    fullName,
    role,
    claims,
    validateClaim,
    isComplianceOfficer,
    userInfo: { tenantName: req.user.token.tenantName, role, token: bearerToken, validateClaim },
  };
}

/**
 * Validates case closure data
 * @param dto Close case DTO containing closure information
 * @returns Array of validation error messages (empty if valid)
 */
// export function validateClosureData(dto: CloseCaseDto): string[] {
//   const errors: string[] = [];

//   if (!dto.recommendedOutcome) {
//     errors.push('Recommended outcome is required');
//   }

//   if (dto.recommendedOutcome && !CASE_CLOSURE_OUTCOMES.includes(dto.recommendedOutcome)) {
//     errors.push(`Invalid recommended outcome. Must be one of: ${CASE_CLOSURE_OUTCOMES.join(', ')}`);
//   }

//   if (!dto.finalNotes || dto.finalNotes.trim().length < VALIDATION_LENGTHS.MIN_FINAL_NOTES) {
//     errors.push(`Final notes are required and must be at least ${VALIDATION_LENGTHS.MIN_FINAL_NOTES} characters`);
//   }

//   return errors;
// }

/**
 * Validates case completion fields
 * @param existingCase Case entity to validate
 * @returns Array of missing field names (empty if valid)
 */
export function validateCaseCompletionFields(existingCase: any): string[] {
  const missing: string[] = [];
  if (!existingCase.priority) missing.push('priority');
  if (!existingCase.case_type) missing.push('case_type');
  return missing;
}

/**
 * Determines original closed status from case data
 * Defaults to INCONCLUSIVE if cannot be determined
 * @param caseData Case entity
 * @returns Original closed status
 */
export function determineOriginalClosedStatus(caseData: any): CaseStatus {
  // Could check case history/audit logs here in future
  // For now, default to inconclusive as safe fallback
  return CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE;
}

/**
 * Checks if a role is an investigator/analyst role
 * @param role Role string to check
 * @returns True if role is an investigator variant
 */
export function isInvestigatorRole(role: string | null): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase();
  return upperRole === 'ANALYST' || upperRole === 'INVESTIGATOR' || upperRole === 'CMS_INVESTIGATOR';
}

/**
 * Parses reopening metadata from comment
 * @param comment Comment containing JSON metadata
 * @returns Parsed metadata or empty object
 */
export function parseReopeningMetadata(comment: string): {
  requestedBy?: string;
  requesterRole?: string;
  reason?: string;
  previousStatus?: string;
} {
  try {
    return JSON.parse(comment);
  } catch (parseError) {
    return {};
  }
}
