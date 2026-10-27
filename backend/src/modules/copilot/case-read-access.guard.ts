import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { CaseInvestigatorService } from '../case-investigator/case-investigator.service';
import { callerOf } from './request-context';

/**
 * Follows the case ACL for every route with a :caseId. The copilot reads investigation notes and transactions,
 * which a revoked or non-member investigator must not see, so no access gets the same 404 as the other gated reads.
 * Runs after TazamaAuthGuard, which sets the user.
 */
@Injectable()
export class CaseReadAccessGuard implements CanActivate {
  constructor(private readonly access: CaseInvestigatorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { userId, tenantId } = callerOf(req);
    await this.access.assertReadAccess(Number(req.params.caseId), userId, tenantId, req.user.actorRole);
    return true;
  }
}
