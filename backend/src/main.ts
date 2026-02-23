import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const logger = app.get(LoggerService);
    const configService = app.get(ConfigService);
    app.useLogger(logger);

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

    logger.log(`Application started on port ${port}`);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

void bootstrap();
