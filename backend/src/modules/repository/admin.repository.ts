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
    tenantId: string,
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
        data: {
          ...idData,
          tenant_id: tenantId,
        },
      });

      return referenceId;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('ReferenceId already exists', { cause: error });
      }
      throw new Error('Failed to register ReferenceId', { cause: error });
    }
  }

  async getReferenceId(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<
    Array<{
      txTp: string;
      referenceIdName: string;
      createdAt: Date;
      id: number;
    }>
  > {
    try {
      const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
      const referenceIds = await client.referenceId.findMany({
        where: {
          tenant_id: tenantId,
        },
        select: {
          txTp: true,
          referenceIdName: true,
          createdAt: true,
          id: true,
        },
      });

      if (referenceIds.length === 0) {
        throw new NotFoundException('No ReferenceIds found');
      }

      return referenceIds;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to retrieve ReferenceIds', { cause: error });
    }
  }
}
