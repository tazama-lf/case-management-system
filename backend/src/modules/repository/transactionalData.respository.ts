import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client-cms';
import { BaseRepository } from './base.repository';

@Injectable()
export class TransactionDataRespository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async getTransactionalData(endToEndId: string) {
    const client: Prisma.TransactionClient | PrismaService = this.prisma;
    const transactionalData = await client.transactionData.findMany({
      where: { endToEndId: endToEndId },
    });

    if (!transactionalData) {
      throw new NotFoundException(`transactional Data with ID ${endToEndId} not found`);
    }

    return transactionalData;
  }
}
