import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
import { TriageModule } from './triage/triage.module';
import { PrismaModule } from './prisma.module';
<<<<<<< HEAD
>>>>>>> 9e1ce67 (feat: audit log)
=======
import { PrismaService } from './prisma/prisma.service';
import { PrismaController } from './prisma/prisma.controller';
import { PrismaModule } from '../prisma/prisma.module';
>>>>>>> a4489c4 (feat/prisma)

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    PrismaModule,
    AuditLogModule,
    TriageModule,
<<<<<<< HEAD
    AuthModule,
  ],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenExpiryInterceptor,
    },
  ],
  providers: [PrismaService],
  controllers: [PrismaController],
})
export class AppModule {}
=======
  ],
})
export class AppModule {}
