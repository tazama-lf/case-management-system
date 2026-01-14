import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class BaseRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prismaService.$transaction(fn);
  }
}
