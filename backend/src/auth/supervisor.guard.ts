import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard to enforce SUPERVISOR role access
 */
@Injectable()
export class SupervisorGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		// Check if user and claims exist
		if (!user || !user.token || !user.token.claims) {
			throw new ForbiddenException('No authenticated user or claims found');
		}

		// SUPERVISOR role enforcement (case-insensitive)
		const claims = user.token.claims.map((c: string) => c.toUpperCase());
		if (!claims.includes('SUPERVISOR')) {
			throw new ForbiddenException('Access denied: SUPERVISOR role required');
		}

		return true;
	}
}
