import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../audit/types/outcome';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async addComment(createCommentDto: CreateCommentDto, userId: string) {
    this.logger.log(`Adding comment : ${userId}`, CommentService.name);
    try {
      if (!createCommentDto.caseId && !createCommentDto.taskId) {
        throw new BadRequestException('Either caseId or taskId must be provided');
      }

      if (createCommentDto.caseId && createCommentDto.taskId) {
        throw new BadRequestException('Cannot provide both caseId and taskId');
      }
      const comment = await this.prisma.comment.create({
        data: {
          user_id: userId,
          case_id: createCommentDto.caseId ?? null,
          task_id: createCommentDto.taskId ?? null,
          note: createCommentDto.note,
        },
      });

      return comment;
    } catch (error) {
      this.logger.error('Error adding comment', error, CommentService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'addComment',
        entityName: CommentService.name,
        actionPerformed: `Attempt to write a comment: ${createCommentDto.note}`,
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
    }
  }

  async getComment(commentId: string, userId: string) {
    this.logger.log('Retrieving comment', CommentService.name);
    try {
      const comment = await this.prisma.comment.findUnique({
        where: {
          comment_id: commentId,
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      this.auditLogService.logAction({
        userId,
        operation: 'getComment',
        entityName: CommentService.name,
        actionPerformed: `Successfully retrieved comment with ID: ${commentId}`,
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
      });

      return comment;
    } catch (error) {
      this.logger.error('Error retrieving comment', error, CommentService.name);
      this.auditLogService.logAction({
        userId,
        operation: 'getComment',
        entityName: CommentService.name,
        actionPerformed: `Error retrieving comment with ID: ${commentId}`,
        outcome: Outcome.FAILURE,
        performedAt: new Date(),
      });
      throw error;
    }
  }

  async getCommentsByCaseOrTask(caseId?: string, taskId?: string, userId?: string) {
    this.logger.log('Retrieving comments by case or task', CommentService.name);
    try {
      if (!caseId && !taskId) {
        throw new BadRequestException('Either caseId or taskId must be provided');
      }

      if (caseId && taskId) {
        throw new BadRequestException('Cannot provide both caseId and taskId');
      }

      const where = caseId ? { case_id: caseId } : { task_id: taskId };

      const comments = await this.prisma.comment.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
      });

      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByCaseOrTask',
          entityName: CommentService.name,
          actionPerformed: `Successfully retrieved comments for ${caseId ? 'case' : 'task'} ID: ${caseId || taskId}`,
          outcome: Outcome.SUCCESS,
          performedAt: new Date(),
        });
      }

      return comments;
    } catch (error) {
      this.logger.error('Error retrieving comments', error, CommentService.name);
      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByCaseOrTask',
          entityName: CommentService.name,
          actionPerformed: `Error retrieving comments for ${caseId ? 'case' : 'task'} ID: ${caseId || taskId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }


  async getCommentsByCaseId(caseId: string,  userId?: string) {
   this.logger.log('Retrieving comments by caseId: ', CommentService.name);

  try {
   const comments = await this.prisma.comment.findMany({
      where: { case_id: caseId }
    });

    if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByCaseId',
          entityName: CommentService.name,
          actionPerformed: `Successfully retrieved comments for case ID: ${caseId}`,
          outcome: Outcome.SUCCESS,
          performedAt: new Date(),
        });
      }

      return comments;
    } catch (error) {
      this.logger.error('Error retrieving comments', error, CommentService.name);
      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByCaseId',
          entityName: CommentService.name,
          actionPerformed: `Error retrieving comments for caseID: ${caseId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }

 

  

}
