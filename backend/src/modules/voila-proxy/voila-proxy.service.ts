import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * VoilaProxyService handles request proxying to Voila.
 */
@Injectable()
export class VoilaProxyService {
  private readonly logger = new Logger(VoilaProxyService.name);
  private readonly voilaBaseUrl: string;
  private readonly proxyMiddleware: ReturnType<typeof createProxyMiddleware>;

  constructor(private readonly configService: ConfigService) {
    // Get configuration from environment
    this.voilaBaseUrl = this.configService.getOrThrow<string>('VOILA_BASE_URL');

    // Create proxy middleware instance
    this.proxyMiddleware = createProxyMiddleware({
      target: this.voilaBaseUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/voila-proxy': '', // Remove /voila-proxy prefix
      },
      on: {
        proxyReq: (proxyReq, req, res) => {
          this.logger.log(`[ProxyMiddleware] Forwarding ${req.method} ${req.url} → ${this.voilaBaseUrl}${proxyReq.path}`);
        },
        proxyRes: (proxyRes, req, res) => {
          this.logger.log(`[ProxyMiddleware] Response received: ${proxyRes.statusCode} for ${req.url}`);
        },
        error: (err, req, res) => {
          this.logger.error(`[ProxyMiddleware] Connection error for ${req.url}: ${err.message}`);
          this.logger.error(`[ProxyMiddleware] Stack: ${err.stack}`);
          // Check if res is a ServerResponse (has writeHead method)
          if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
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
      },
    });

    this.logger.log(`VoilaProxyService initialized with target: ${this.voilaBaseUrl}`);
  }

  /**
   * Proxy the incoming request to Voila, appending the service token to query params.
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param serviceToken - The minted service token
   */
  async proxyRequest(req: Request, res: Response, serviceToken: string): Promise<void> {
    this.logger.log('[ProxyRequest] Appending service_token to request URL');

    // Append service_token to query parameters by modifying the original request URL
    const separator = req.url.includes('?') ? '&' : '?';
    const originalUrl = req.url;
    req.url = `${originalUrl}${separator}service_token=${encodeURIComponent(serviceToken)}`;

    this.logger.log(`[ProxyRequest] Modified URL: ${req.url}`);
    this.logger.log(`[ProxyRequest] Forwarding to Voila at: ${this.voilaBaseUrl}`);

    // Use the proxy middleware to forward the request
    await new Promise<void>((resolve, reject) => {
      this.proxyMiddleware(req as any, res as any, (error?: any) => {
        if (error) {
          this.logger.error(`[ProxyRequest] Proxy middleware error: ${error.message}`);
          reject(error);
        } else {
          this.logger.log('[ProxyRequest] Proxy middleware completed successfully');
          resolve();
        }
      });
    });
  }
}
