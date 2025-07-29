import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
=======
import { PrismaService } from 'src/prisma.service';

@Module({
    providers: [PrismaService],
    exports: [PrismaService]
>>>>>>> a4489c4 (feat/prisma)
})
export class PrismaModule {}
