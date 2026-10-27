import { BadRequestException } from '@nestjs/common';
import { TazamaClaims } from 'src/decorators/auth.decorator';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import type { Caller } from './copilot.types';
import type { ReviewRole } from './sar-review';

/** Who is asking, from the verified token. A token without a tenant is refused. */
export function callerOf(req: AuthenticatedRequest): Caller {
  const { clientId, tenantId } = req.user.token;
  if (!tenantId) throw new BadRequestException('Missing tenantId');
  return { userId: clientId, tenantId, name: req.user.actorName ?? req.user.actorEmail ?? 'CMS user', email: req.user.actorEmail };
}

/** Supervisors review (checker); investigators and compliance officers prepare and file (maker). */
export function roleOf(req: AuthenticatedRequest): ReviewRole {
  return req.user.validClaims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'checker' : 'maker';
}
