import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { GoldLakehouseController } from './gold-lakehouse.controller';
import { AlertsLakehouseService } from './alerts-lakehouse.service';
import { TransactionLakehouseService } from './transaction-lakehouse.service';
import { ConditionLakehouseService } from './condition-lakehouse.service';
import { BenfordsLawLakehouseService } from './benfordsLaw-lakehouse.service';
import { AccountLakehouseService } from './account-lakehouse.service';
import { EntityLakehouseService } from './entity-lakehouse.service';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    RepositoryModule,
  ],
  controllers: [GoldLakehouseController],
  providers: [
    GoldLakehouseService,
    AlertsLakehouseService,
    TransactionLakehouseService,
    ConditionLakehouseService,
    BenfordsLawLakehouseService,
    AccountLakehouseService,
    EntityLakehouseService,
  ],
  exports: [
    GoldLakehouseService,
    AlertsLakehouseService,
    TransactionLakehouseService,
    ConditionLakehouseService,
    BenfordsLawLakehouseService,
    AccountLakehouseService,
    EntityLakehouseService,
  ],
})
export class GoldLakehouseModule {}
