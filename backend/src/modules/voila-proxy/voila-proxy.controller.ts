import { Controller, All, Req, Res, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { VoilaProxyService } from './voila-proxy.service';
import * as jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../shared/cache.service';

/**
 * VoilaProxyController handles proxying requests to Voila notebooks.
 *
 * Flow:
 * 1. Browser sends request to /voila-proxy/* with JWT cookie
 * 2. Extract and validate user JWT from HttpOnly cookie
 * 3. Store user JWT in cache for later retrieval
 * 4. Mint short-lived service token (2min) with userId
 * 5. Append service_token to query params
 * 6. Proxy request to Voila server (internal-only)
 *
 * Note: This controller handles /voila-proxy/* and /voila/* routes.
 * - /voila/* route is for static assets referenced by Voila notebooks
 * - /api/kernels/* routes are handled by middleware for WebSocket support
 */
@Controller(['voila-proxy', 'voila'])
export class VoilaProxyController {
  private readonly logger = new Logger(VoilaProxyController.name);
  private readonly publicKey: string;

  constructor(
    private readonly voilaProxyService: VoilaProxyService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    // Load Tazama's RSA public key for validating user JWT tokens
    const publicKeyPath = this.configService.getOrThrow<string>('AUTH_PUBLIC_KEY_PATH');
    this.publicKey = fs.readFileSync(path.resolve(process.cwd(), publicKeyPath), 'utf8');
  }

  @All('*path')
  async proxyToVoila(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.logger.log(`[VoilaProxy] Incoming request: ${req.method} ${req.url}`);
    // this.logger.log(`[VoilaProxy] Request headers: ${JSON.stringify(req.headers)}`);

    try {
      // Check if this is a static file request that should bypass authentication
      if (this.isStaticFileRequest(req)) {
        this.logger.log('[VoilaProxy] Static file request - bypassing authentication');
        await this.voilaProxyService.proxyRequest(req, res, '');
        return;
      }

      // Extract and validate access token
      const accessToken = this.extractAccessToken(req);

      // Verify JWT and get userId
      const userId = this.verifyAndExtractUserId(accessToken);

      // Store user token in cache
      await this.storeUserToken(userId, accessToken);

      // Proxy the request to Voila with the user's JWT
      this.logger.log('[VoilaProxy] Proxying request to Voila server...');
      await this.voilaProxyService.proxyRequest(req, res, accessToken);
      this.logger.log('[VoilaProxy] Request proxied successfully');
    } catch (error) {
      this.logger.error(`[VoilaProxy] Error occurred: ${error instanceof Error ? error.message : error}`);

      if (error instanceof UnauthorizedException) {
        this.logger.warn(`[VoilaProxy] Unauthorized: ${error.message}`);
        res.status(401).json({
          statusCode: 401,
          message: error.message,
          error: 'Unauthorized',
        });
        return;
      }

      this.logger.error(`[VoilaProxy] Internal server error: ${error instanceof Error ? error.stack : error}`);
      res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      });
    }
  }

  /**
   * Check if the request is for a static file that should bypass authentication.
   */
  private isStaticFileRequest(req: Request): boolean {
    return (
      req.url.startsWith('/voila/static') ||
      req.url.startsWith('/voila/templates') ||
      req.url.startsWith('/voila/files') ||
      req.url.startsWith('/voila/api/themes')
    );
  }

  /**
   * Extract access token from cookies.
   */
  private extractAccessToken(req: Request): string {
    const cookies = req.cookies as Record<string, unknown> | undefined;

    if (!cookies) {
      this.logger.warn('[VoilaProxy] No cookies found in request');
      throw new UnauthorizedException('Authentication required');
    }

    for (const [cookieName, cookieValue] of Object.entries(cookies)) {
      if (cookieName.startsWith('access_token_')) {
        this.logger.log(`[VoilaProxy] Found access token in cookie: ${cookieName}`);
        return cookieValue as string;
      }
    }

    this.logger.warn('[VoilaProxy] No access_token_* cookie found in request');
    this.logger.log(`[VoilaProxy] Available cookies: ${Object.keys(cookies).join(', ')}`);
    throw new UnauthorizedException('Authentication required');
  }

  /**
   * Verify JWT and extract userId.
   */
  private verifyAndExtractUserId(accessToken: string): string {
    try {
      this.logger.log('[VoilaProxy] Verifying JWT with RSA public key...');
      const decoded = jwt.verify(accessToken, this.publicKey, { algorithms: ['RS256'] }) as {
        clientId?: string;
        sub?: string;
      };

      // Extract userId from token (could be in clientId or sub)
      const userId = decoded.clientId ?? decoded.sub ?? '';

      if (!userId) {
        this.logger.warn('[VoilaProxy] JWT token missing userId (clientId/sub)');
        throw new UnauthorizedException('Invalid token: missing user identifier');
      }

      this.logger.log(`[VoilaProxy] JWT verified successfully for user: ${userId}`);
      return userId;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          this.logger.warn('[VoilaProxy] User JWT expired');
          throw new UnauthorizedException('Token expired');
        }
        if (error.name === 'JsonWebTokenError') {
          this.logger.warn(`[VoilaProxy] Invalid JWT: ${error.message}`);
          throw new UnauthorizedException('Invalid token');
        }
      }
      this.logger.error(`[VoilaProxy] Token validation failed: ${error}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Store user token in cache.
   */
  private async storeUserToken(userId: string, accessToken: string): Promise<void> {
    this.logger.log(`[VoilaProxy] Storing user JWT in cache for userId: ${userId}`);
    await this.cacheService.setUserToken(userId, accessToken);
    this.logger.log('[VoilaProxy] User JWT cached successfully');
  }
}
