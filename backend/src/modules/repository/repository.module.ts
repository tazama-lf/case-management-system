import { Module } from '@nestjs/common';
import { AlertRepository } from './alert.repository';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AlertRepository],
  exports: [AlertRepository],
})
export class RepositoryModule {}
