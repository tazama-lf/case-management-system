import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../utils/types/outcome';
import { CommentRepository } from '../repository/comment.repository';
import { Comment } from '@prisma/client-cms';

@Injectable()
export class CommentService {
  constructor(
    private readonly logger: LoggerService,
    private readonly commentRepository: CommentRepository,
  ) {}

  async addComment(createCommentDto: CreateCommentDto, userId: string): Promise<Comment | void> {
    this.logger.log(`Adding comment : ${userId}`, CommentService.name);

    if (!createCommentDto.caseId && !createCommentDto.taskId) {
      throw new BadRequestException('Either caseId or taskId must be provided');
    }

    if (!createCommentDto.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const comment = await this.commentRepository.createComment(userId, createCommentDto);

      return comment;
    } catch (error) {
      this.logger.error('Error adding comment', error, CommentService.name);
    }
  }

  async getComment(commentId: number, userId: string, tenantId: string): Promise<Comment> {
    this.logger.log('Retrieving comment', CommentService.name);
    try {
      const comment = await this.commentRepository.getCommentsByCommentId(commentId, tenantId);

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      return comment;
    } catch (error) {
      this.logger.error('Error retrieving comment', error, CommentService.name);
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

      return comments;
    } catch (error) {
      this.logger.error('Error retrieving comments', error, CommentService.name);
      throw error;
    }
  }

  async getCommentsByCaseId(caseId: number, userId?: string): Promise<Comment[]> {
    this.logger.log('Retrieving comments by caseId: ', CommentService.name);

    try {
      const comments = await this.commentRepository.getCommentsByCaseId(caseId);

      return comments;
    } catch (error) {
      this.logger.error('Error retrieving comments', error, CommentService.name);
      throw error;
    }
  }

  async getCommentsByTaskId(taskId: number, userId?: string): Promise<Comment[]> {
    this.logger.log('Retrieving comments by taskId: ', CommentService.name);

    try {
      const comments = await this.commentRepository.getCommentsByTaskId(taskId);
      return comments;
    } catch (error) {
      this.logger.error('Error retrieving comments', error, CommentService.name);
      throw error;
    }
  }
}
