import { Module } from '@nestjs/common';
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
})
export class PrismaModule {}
