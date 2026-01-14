import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client-cms';
import { PrismaService } from 'prisma/prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class AdminRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async registerReferenceId(idData: Prisma.ReferenceIdCreateInput) {
    try {
      const referenceId = await this.prisma.referenceId.create({
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

  async getReferenceId() {
    try {
      const referenceIds = await this.prisma.referenceId.findMany();

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
