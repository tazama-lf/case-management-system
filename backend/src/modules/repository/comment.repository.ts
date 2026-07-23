import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { BaseRepository } from './base.repository';
import { Prisma, Comment } from '@prisma/client-cms';

@Injectable()
export class CommentRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  async createComment(userId: string, createCommentDto: CreateCommentDto, tx?: Prisma.TransactionClient): Promise<Comment> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.comment.create({
      data: {
        user_id: userId,
        tenant_id: createCommentDto.tenantId,
        case_id: createCommentDto.caseId,
        task_id: createCommentDto.taskId ?? null,
        note: createCommentDto.note,
      },
    });
  }

  async getCommentsByCommentId(commentId: number, tenantId: string, tx?: Prisma.TransactionClient): Promise<Comment | null> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.comment.findUnique({
      where: {
        comment_id: commentId,
        tenant_id: tenantId,
      },
    });
  }

  async getCommentsByCaseId(caseId?: number, tenantId?: string, tx?: Prisma.TransactionClient): Promise<Comment[]> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.comment.findMany({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async getCommentsByTaskId(taskId?: number, tenantId?: string, tx?: Prisma.TransactionClient): Promise<Comment[]> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    return await client.comment.findMany({
      where: {
        task_id: taskId,
        tenant_id: tenantId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }
}
