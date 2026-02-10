import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { createFilterDto } from '../filter/dto/create-filter.dto';
import { BaseRepository } from './base.repository';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class FilterRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async createFilter(userId: string, createFilterDto: createFilterDto, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return await client.filters.create({
      data: {
        user_Id: userId,
        filter_type: createFilterDto.filterType,
        user_filters: createFilterDto.userFilters,
      },
    });
  }

  async getFiltersByUserAndType(userId: string, filterType: string, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx || this.prisma;
    return await client.filters.findMany({
      where: {
        user_Id: userId,
        filter_type: filterType,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }
}
