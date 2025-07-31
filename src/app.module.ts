import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
<<<<<<< HEAD
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TriageModule } from './triage/triage.module';
<<<<<<< HEAD
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './auth/token-expiry.interceptor';
=======
import { TriageModule } from './triage/triage.module';
<<<<<<< HEAD
import { PrismaModule } from './prisma.module';
<<<<<<< HEAD
>>>>>>> 9e1ce67 (feat: audit log)
=======
import { PrismaService } from './prisma/prisma.service';
import { PrismaController } from './prisma/prisma.controller';
import { PrismaModule } from '../prisma/prisma.module';
>>>>>>> a4489c4 (feat/prisma)
=======
import { PrismaModule } from 'prisma/prisma.module';
import { PrismaService } from 'prisma/prisma.service';
=======
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
>>>>>>> bb28498 (feat:fixing the conflic merge)
import { AuthModule } from './auth/auth.module';

>>>>>>> 34b27df (feat:auth)

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
<<<<<<< HEAD
    AuthModule,
  ],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenExpiryInterceptor,
    },
=======
    AuthModule,
>>>>>>> ea2f4e8 (feat:auth)
  ],
  providers: [PrismaService],
})
export class AppModule {}
=======
  ],
})
export class AppModule {}
