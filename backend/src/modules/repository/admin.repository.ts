import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client-cms';
import { PrismaService } from 'prisma/prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class AdminRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async registerReferenceId(
    idData: Prisma.ReferenceIdCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    txTp: string;
    referenceIdName: string;
    createdAt: Date;
    id: number;
  }> {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
      const referenceId = await client.referenceId.create({
        data: idData,
      });

      if (!referenceId) {
        throw new Error('Failed to create ReferenceId');
      }

      return referenceId;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('ReferenceId already exists');
      }
      throw new Error(`Failed to create ReferenceId: ${error.message}`);
    }
  }

  async getReferenceId(tx?: Prisma.TransactionClient): Promise<
    Array<{
      txTp: string;
      referenceIdName: string;
      createdAt: Date;
      id: number;
    }>
  > {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
      const referenceIds = await client.referenceId.findMany();

      if (!referenceIds) {
        throw new NotFoundException('No ReferenceIds found');
      }

      return referenceIds;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to retrieve ReferenceIds: ${error.message}`);
    }
  }
}
