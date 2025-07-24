import { NestFactory } from '@nestjs/core';
<<<<<<< HEAD
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application started on port ${port}`);
=======
import { TriageModule } from './triage/triage.module';

async function bootstrap() {
  const app = await NestFactory.create(TriageModule);
  await app.listen(process.env.PORT ?? 3000);
>>>>>>> 875cecd (feat(core): init NestJS with triage mock API)
}
bootstrap();
