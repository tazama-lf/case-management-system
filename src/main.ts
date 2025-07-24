import { NestFactory } from '@nestjs/core';
import { TriageModule } from './triage/triage.module';

async function bootstrap() {
  const app = await NestFactory.create(TriageModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
