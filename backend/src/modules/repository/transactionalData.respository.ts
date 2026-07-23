import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, TransactionData } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class TransactionDataRespository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async getTransactionalData(endToEndId: string): Promise<TransactionData[] | null> {
    const client: Prisma.TransactionClient | PrismaService = this.prisma;
    const transactionalData = await client.transactionData.findMany({
      where: { endToEndId },
    });

    if (!transactionalData.length) {
      throw new NotFoundException(`transactional Data with ID ${endToEndId} not found`);
    }

    return transactionalData;
  }
}
