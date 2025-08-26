import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Validate and get the processor config for LoggerService
  const configuration = validateProcessorConfig();
  const logger = new LoggerService(configuration);

  const app = await NestFactory.create(AppModule, {
    logger,
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application started on port ${port}`);
}

bootstrap();
