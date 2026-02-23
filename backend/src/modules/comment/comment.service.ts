import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../utils/types/outcome';
import { CommentRepository } from '../repository/comment.repository';
import { Comment } from '@prisma/client-cms';

@Injectable()
export class CommentService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly commentRepository: CommentRepository,
  ) {}

  async addComment(createCommentDto: CreateCommentDto, userId: string) {
    this.logger.log(`Adding comment : ${userId}`, CommentService.name);
    try {
      if (!createCommentDto.caseId && !createCommentDto.taskId) {
        throw new BadRequestException('Either caseId or taskId must be provided');
      }

      if (!createCommentDto.tenantId) {
        throw new BadRequestException('tenantId is required');
      }

      const comment = await this.commentRepository.createComment(userId, createCommentDto);

      this.auditLogService.logAction({
        userId,
        operation: 'addComment',
        entityName: CommentService.name,
        actionPerformed: createCommentDto.note,
        outcome: Outcome.SUCCESS,
        performedAt: new Date(),
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

  async getComment(commentId: number, userId: string, tenantId: string): Promise<Comment> {
    this.logger.log('Retrieving comment', CommentService.name);
    try {
      const comment = await this.commentRepository.getCommentsByCommentId(commentId, tenantId);

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

  async getCommentsByCaseOrTask(caseId?: number, taskId?: number, userId?: string): Promise<Comment[]> {
    this.logger.log('Retrieving comments by case or task', CommentService.name);
    try {
      if (!caseId && !taskId) {
        throw new BadRequestException('Either caseId or taskId must be provided');
      }

      if (caseId && taskId) {
        throw new BadRequestException('Cannot provide both caseId and taskId');
      }

      const comments = caseId
        ? await this.commentRepository.getCommentsByCaseId(caseId)
        : await this.commentRepository.getCommentsByTaskId(taskId);

      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByCaseOrTask',
          entityName: CommentService.name,
          actionPerformed: `Successfully retrieved comments for ${caseId ? 'case' : 'task'} ID: ${caseId ?? taskId}`,
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
          actionPerformed: `Error retrieving comments for ${caseId ? 'case' : 'task'} ID: ${caseId ?? taskId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }

  async getCommentsByCaseId(caseId: number, userId?: string): Promise<Comment[]> {
    this.logger.log('Retrieving comments by caseId: ', CommentService.name);

    try {
      const comments = await this.commentRepository.getCommentsByCaseId(caseId);

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

  async getCommentsByTaskId(taskId: number, userId?: string): Promise<Comment[]> {
    this.logger.log('Retrieving comments by taskId: ', CommentService.name);

    try {
      const comments = await this.commentRepository.getCommentsByTaskId(taskId);

      if (userId) {
        this.auditLogService.logAction({
          userId,
          operation: 'getCommentsByTaskId',
          entityName: CommentService.name,
          actionPerformed: `Successfully retrieved comments for task ID: ${taskId}`,
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
          operation: 'getCommentsByTaskId',
          entityName: CommentService.name,
          actionPerformed: `Error retrieving comments for task ID: ${taskId}`,
          outcome: Outcome.FAILURE,
          performedAt: new Date(),
        });
      }
      throw error;
    }
  }
}
