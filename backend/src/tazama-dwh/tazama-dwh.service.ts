import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaDWHService } from '../../prismaDWH/prismaDWH.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib/lib/services/logger';

@Injectable()
export class TazamaDwhService {
  constructor(
    private readonly prismaDwh: PrismaDWHService,
    private readonly logger: LoggerService,
  ) {}

  async getTransactionsByCreditorId(
    tenantId: string,
    creditorId: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      const where: any = {
        tenant_id: tenantId,
        destination: creditorId,
      };

      if (startDate || endDate) {
        where.cre_dt_tm = {};
        if (startDate) where.cre_dt_tm.gte = startDate;
        if (endDate) where.cre_dt_tm.lte = endDate;
      }

      const transactions = await this.prismaDwh.transaction.findMany({
        where,
        orderBy: { cre_dt_tm: 'desc' },
      });

      if (!transactions.length) {
        throw new NotFoundException(`No transactions found for creditorId=${creditorId}`);
      }

      return transactions;
    } catch (err) {
      this.logger.error(`Failed to fetch transactions from DWH: ${err}`);
      throw new InternalServerErrorException('Failed to fetch transactions from DWH');
    }
  }
}
