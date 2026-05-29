import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as httpProxy from 'http-proxy';
import * as jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LoggerService);
  const configService = app.get(ConfigService);
  app.useLogger(logger);

  app.use(cookieParser());

  const voilaBaseUrl = configService.getOrThrow<string>('VOILA_BASE_URL');
  const publicKeyPath = configService.getOrThrow<string>('AUTH_PUBLIC_KEY_PATH');
  const publicKey = fs.readFileSync(path.resolve(process.cwd(), publicKeyPath), 'utf8');

  /**
   * Extract access token from cookies (reusing VoilaProxyController logic)
   */
  const extractAccessToken = (req: Request | IncomingMessage): string | null => {
    const cookies = (req as Request).cookies as Record<string, unknown> | undefined;
    if (!cookies) {
      // For WebSocket upgrade requests, manually parse Cookie header
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) {
        return null;
      }
      const cookiePairs = cookieHeader.split(';').map((c) => c.trim());
      for (const pair of cookiePairs) {
        const [key] = pair.split('=');
        if (key.startsWith('access_token_')) {
          const value = pair.substring(key.length + 1);
          return decodeURIComponent(value);
        }
      }
      return null;
    }
    for (const [cookieName, cookieValue] of Object.entries(cookies)) {
      if (cookieName.startsWith('access_token_')) {
        return cookieValue as string;
      }
    }
    return null;
  };

  /**
   * Verify JWT token (reusing VoilaProxyController logic)
   */
  const verifyToken = (accessToken: string): boolean => {
    try {
      const decoded = jwt.verify(accessToken, publicKey, { algorithms: ['RS256'] }) as {
        clientId?: string;
        sub?: string;
      };
      const userId = decoded.clientId ?? decoded.sub ?? '';
      return Boolean(userId);
    } catch {
      return false;
    }
  };

  const proxy = httpProxy.default.createProxyServer({
    target: voilaBaseUrl,
    changeOrigin: true,
  });

  proxy.on('error', (err, req, res) => {
    logger.error(`[Kernels] Proxy error: ${err.message}`);
    // Ensure response is terminated properly (res is ServerResponse in HTTP context)
    if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  app.use('/api/kernels', (req: Request, res: Response, next) => {
    // Enforce authentication
    const accessToken = extractAccessToken(req);
    if (!accessToken || !verifyToken(accessToken)) {
      logger.warn(`[Kernels] Unauthorized request to ${req.url}`);
      res.status(401).json({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
      return;
    }

    logger.log(`[Kernels] Proxying authenticated request: ${req.method} ${req.url}`);
    proxy.web(req, res, {}, (err?: Error) => {
      if (err) {
        logger.error(`[Kernels] Proxy callback error: ${err.message}`);
        res.status(502).end('Bad Gateway');
      }
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  // Temporary - allow all origins (for testing only)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Case Management System')
    .setDescription('Case Management APIs')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'jwt')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  const port = configService.get<number>('PORT', 3090);
  await app.listen(port);

  // Manually handle WebSocket upgrades AFTER server is listening
  const server = app.getHttpServer();
  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (req.url?.startsWith('/api/kernels/')) {
      // Enforce authentication for WebSocket connections
      const accessToken = extractAccessToken(req);
      if (!accessToken || !verifyToken(accessToken)) {
        logger.warn(`[Kernels WS] Unauthorized WebSocket upgrade attempt to ${req.url}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      logger.log(`[Kernels WS] Upgrading authenticated WebSocket: ${req.url} → ${voilaBaseUrl}${req.url}`);
      // Rewrite Origin header to match Voila's host — Tornado rejects mismatched origins with 403
      // Create a shallow clone of req with modified headers
      const modifiedReq = Object.create(Object.getPrototypeOf(req), Object.getOwnPropertyDescriptors(req));
      modifiedReq.headers = { ...req.headers, origin: voilaBaseUrl };

      // Handle WebSocket proxy errors
      const errorHandler = (err: Error): void => {
        logger.error(`[Kernels WS] WebSocket proxy error: ${err.message}`);
        if (!socket.destroyed) {
          socket.destroy();
        }
      };

      // Attach one-time error handler for this specific upgrade
      proxy.once('error', errorHandler);

      try {
        proxy.ws(modifiedReq, socket, head);
      } catch (err) {
        logger.error(`[Kernels WS] WebSocket upgrade failed: ${err instanceof Error ? err.message : err}`);
        if (!socket.destroyed) {
          socket.destroy();
        }
      }
    }
  });

  logger.log(`Application started on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  logger.log(`WebSocket proxy enabled for /api/kernels/* → ${voilaBaseUrl}`);
}

void bootstrap();
