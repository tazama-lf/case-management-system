<<<<<<< HEAD
<<<<<<< HEAD
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
<<<<<<< HEAD
=======
import { Injectable } from '@nestjs/common';
=======
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
>>>>>>> bb28498 (feat:fixing the conflic merge)
import { PrismaClient } from '@prisma/client';
@Injectable()
<<<<<<< HEAD
export class PrismaService extends PrismaClient {}
>>>>>>> a4489c4 (feat/prisma)
=======
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
>>>>>>> bb28498 (feat:fixing the conflic merge)
=======
>>>>>>> ac7173e (feat: Test Coverage)
