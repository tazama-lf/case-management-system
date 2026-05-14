import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LoggerService);
  const configService = app.get(ConfigService);
  app.useLogger(logger);

  // Enable cookie parser to read HttpOnly cookies
  app.use(cookieParser());

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
