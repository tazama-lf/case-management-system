import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class TransactionDataRespository {
  constructor(private readonly prisma: PrismaService) { }

  async getTransactionalData(endToEndId: string) {
    const transactionalData = await this.prisma.transactionData.findMany({
      where: { endToEndId: endToEndId },
    });

    if (!transactionalData) {
      throw new NotFoundException(`transactional Data with ID ${endToEndId} not found`);
    }

    return transactionalData;
  }


}
