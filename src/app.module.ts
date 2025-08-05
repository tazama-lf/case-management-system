import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from './audit/auditLog.module';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
<<<<<<< HEAD
import { TriageModule } from './triage/triage.module';
<<<<<<< HEAD
import { PrismaService } from '../prisma/prisma.service';
import { TokenExpiryInterceptor } from './auth/token-expiry.interceptor';
<<<<<<< HEAD
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
=======

>>>>>>> d0ff41d (feat:adding auth service)
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from 'prisma/prisma.module';
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
import { TriageModule } from './triage/triage.module';
<<<<<<< HEAD
import { PrismaService } from 'prisma/prisma.service';

>>>>>>> 34b27df (feat:auth)
=======
import { PrismaService } from '../prisma/prisma.service';
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)

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
<<<<<<< HEAD
=======
    AuthModule,
>>>>>>> ea2f4e8 (feat:auth)
  ],
  providers: [PrismaService],
=======
  ],
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
})
export class AppModule {}
<<<<<<< HEAD
=======
  ],
})
export class AppModule {}
>>>>>>> 9e1ce67 (feat: audit log)
=======
>>>>>>> ac7173e (feat: Test Coverage)
