import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as httpProxy from 'http-proxy';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LoggerService);
  const configService = app.get(ConfigService);
  app.useLogger(logger);

  app.use(cookieParser());

  const voilaBaseUrl = configService.getOrThrow<string>('VOILA_BASE_URL');

  const proxy = httpProxy.default.createProxyServer({
    target: voilaBaseUrl,
    changeOrigin: true,
  });

  proxy.on('error', (err, req, res) => {
    logger.error(`[WS] Proxy error: ${err.message}`);
  });

  app.use('/api/kernels', (req: Request, res: Response, next) => {
    // Enforce authentication
    const accessToken = extractAccessToken(req);
    if (!accessToken || !verifyToken(accessToken)) {
      logger.warn(`[Kernels] Unauthorized request to ${req.originalUrl}`);
      res.status(401).json({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
      return;
    }

    // Express strips the mount path (/api/kernels) from req.url when using app.use(path, ...).
    // Restore the full path so Voila receives the request at its actual API endpoint.
    // eslint-disable-next-line no-param-reassign -- Required to restore the URL stripped by Express mount path
    req.url = req.originalUrl;

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
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/api/kernels/')) {
      // Rewrite Origin header to match Voila's host — Tornado rejects mismatched origins with 403
      const modifiedReq = req;
      modifiedReq.headers = { ...req.headers, origin: voilaBaseUrl };
      logger.log(`[WS] Upgrading ${req.url} → ${voilaBaseUrl}${req.url}`);
      (proxy as any).upgrade(modifiedReq, socket, head);
    }
  });

  logger.log(`Application started on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  logger.log(`WebSocket proxy enabled for /api/kernels/* → ${voilaBaseUrl}`);
  logger.log(`WebSocket proxy enabled for /api/kernels/* → ${voilaBaseUrl}`);
}

void bootstrap();
