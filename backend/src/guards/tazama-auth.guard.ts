import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '../utils/types/auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY } from '../decorators/auth.decorator';
import { validateTazamaToken, extractInnerToken as extractInnerTokenPayload } from './tazama-token-validator';

@Injectable()
export class TazamaAuthGuard implements CanActivate {
  private readonly logger = new Logger(TazamaAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const logContext = 'TazamaAuthGuard.canActivate()';

    if (this.isPublicRoute(context)) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization, logContext);

    const { requiredClaims, anyClaims } = this.getClaimsFromDecorators(context);

    const authenticatedUser: AuthenticatedUser = validateTazamaToken(token, requiredClaims, anyClaims);

    authenticatedUser.sourceIP =
      request.ip ?? (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? request.socket.remoteAddress;

    request.user = authenticatedUser;
    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
  }

  private extractBearerToken(authHeader: string | undefined, ctx: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token provided', ctx);
      throw new UnauthorizedException('No Bearer token provided');
    }
    return authHeader.split(' ')[1];
  }

  private getClaimsFromDecorators(context: ExecutionContext): {
    requiredClaims: string[];
    anyClaims: string[];
  } {
    const requiredClaims =
      this.reflector.getAllAndOverride<string[] | undefined>(CLAIMS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    const anyClaims =
      this.reflector.getAllAndOverride<string[] | undefined>(ANY_CLAIMS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    return { requiredClaims, anyClaims };
  }

  /** AuthService calls this directly on an injected guard instance - kept here as a thin delegate to the shared implementation. */
  extractInnerToken(outerToken: string): Record<string, unknown> {
    return extractInnerTokenPayload(outerToken);
  }
}
