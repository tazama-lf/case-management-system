import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RepositoryModule } from '../repository/repository.module';
import { AdminController } from './admin.controller';

@Module({
  providers: [AdminService],
  imports: [RepositoryModule],
  controllers: [AdminController],
})
export class AdminModule {}
