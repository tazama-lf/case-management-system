import { Module } from '@nestjs/common';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
=======
import { PrismaService } from 'src/prisma.service';
=======
import { PrismaService } from './prisma.service';
>>>>>>> fd5a237 (feat:auth)

@Module({
    providers: [PrismaService],
    exports: [PrismaService]
>>>>>>> a4489c4 (feat/prisma)
=======
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
>>>>>>> bb28498 (feat:fixing the conflic merge)
})
export class PrismaModule {}
