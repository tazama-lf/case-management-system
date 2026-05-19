import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

/**
 * VoilaProxyService handles request proxying to Voila.
 */
@Injectable()
export class VoilaProxyService implements OnModuleInit {
  private readonly logger = new Logger(VoilaProxyService.name);
  private readonly voilaBaseUrl: string;
  private proxyMiddleware: any;

  constructor(private readonly configService: ConfigService) {
    // Get configuration from environment
    this.voilaBaseUrl = this.configService.getOrThrow<string>('VOILA_BASE_URL');
    // Proxy middleware will be initialized asynchronously
  }

  /**
   * Lifecycle hook: Initialize proxy middleware when module is ready.
   */
  async onModuleInit(): Promise<void> {
    await this.initProxy();
  }

  /**
   * Initialize the proxy middleware using dynamic import.
   * Called automatically by onModuleInit lifecycle hook.
   */
  async initProxy(): Promise<void> {
    const { createProxyMiddleware } = await import('http-proxy-middleware');
    this.proxyMiddleware = createProxyMiddleware({
      target: this.voilaBaseUrl,
      changeOrigin: true,
      pathRewrite: (path: string) => {
        const rewritten = path.replace(/^\/voila-proxy/v, '');
        this.logger.log(`[PathRewrite] ${path} → ${rewritten}`);
        return rewritten;
      },
      onProxyReq: (proxyReq: any, req: any, res: any) => {
        this.logger.log(`[ProxyMiddleware] Forwarding ${req.method} ${req.url} → ${this.voilaBaseUrl}${proxyReq.path}`);
      },
      onProxyRes: (proxyRes: any, req: any, res: any) => {
        this.logger.log(`[ProxyMiddleware] Response received: ${proxyRes.statusCode} for ${req.url}`);
      },
      onError: (err: any, req: any, res: any) => {
        this.logger.error(`[ProxyMiddleware] Connection error for ${req.url}: ${err.message}`);
        this.logger.error(`[ProxyMiddleware] Stack: ${err.stack}`);
        if ('writeHead' in res && typeof res.writeHead === 'function') {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 502,
              message: 'Voila server is unavailable',
              error: 'Bad Gateway',
            }),
          );
        }
      },
    });
    this.logger.log(`VoilaProxyService initialized with target: ${this.voilaBaseUrl}`);
  }

  /**
   * Proxy the incoming request to Voila, appending the service token to query params.
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param serviceToken - The minted service token (empty string for static files)
   */
  async proxyRequest(req: Request, res: Response, serviceToken: string): Promise<void> {
    // Create a modified request object to avoid mutating the parameter
    const modifiedReq = req;

    // Only append service_token for authenticated requests (not static files)
    if (serviceToken) {
      this.logger.log('[ProxyRequest] Adding service_token to request');
      // Add as both query parameter and header for maximum compatibility
      const separator = req.url.includes('?') ? '&' : '?';
      const originalUrl = req.url;
      modifiedReq.url = `${originalUrl}${separator}service_token=${encodeURIComponent(serviceToken)}`;

      // Also add as a custom header that Voila can read
      modifiedReq.headers = { ...req.headers, 'x-service-token': serviceToken };

      this.logger.log(`[ProxyRequest] Modified URL: ${modifiedReq.url}`);
    } else {
      this.logger.log('[ProxyRequest] Static file request - no service_token appended');
    }

    this.logger.log(`[ProxyRequest] Forwarding to Voila at: ${this.voilaBaseUrl}`);

    // Use the proxy middleware to forward the request
    // eslint-disable-next-line promise/avoid-new -- Wrapping callback-based middleware in a Promise
    await new Promise<void>((resolve, reject) => {
      this.proxyMiddleware(modifiedReq as any, res as any, (error?: Error) => {
        if (error) {
          this.logger.error(`[ProxyRequest] Proxy middleware error: ${error.message}`);
          reject(new Error(`Proxy error: ${error.message}`));
        } else {
          this.logger.log('[ProxyRequest] Proxy middleware completed successfully');
          resolve();
        }
      });
    });
  }
}
