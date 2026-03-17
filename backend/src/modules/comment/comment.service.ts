import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CommentRepository } from '../repository/comment.repository';
import { CaseRepository } from '../repository/case.repository';
import { Comment } from '@prisma/client-cms';
import { RbacService, EndpointKey } from '../../utils/rbac/rbacHelper';
import type { AuthenticatedUser } from '../../utils/types/auth.types';

@Injectable()
export class CommentService {
  private readonly rbacService = new RbacService();

  constructor(
    private readonly logger: LoggerService,
    private readonly commentRepository: CommentRepository,
    private readonly caseRepository: CaseRepository,
  ) {}

  async addComment(
    createCommentDto: CreateCommentDto,
    userId: string,
    user?: AuthenticatedUser,
    endpointKey?: EndpointKey,
  ): Promise<Comment> {
    this.logger.log(`Adding comment : ${userId}`, CommentService.name);

    if (!createCommentDto.caseId && !createCommentDto.taskId) {
      throw new BadRequestException('Either caseId or taskId must be provided');
    }

    if (!createCommentDto.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    if (user && endpointKey && createCommentDto.caseId) {
      const existingCase = await this.caseRepository.findCaseById(createCommentDto.caseId, createCommentDto.tenantId);
      const rbacRole = this.rbacService.getRoleFromUser(user);
      if (!rbacRole) throw new ForbiddenException('Unrecognised CMS role');
      const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: existingCase.status });
      if (!t2.allowed) throw new ForbiddenException(t2.reason);
    }

    try {
      const comment = await this.commentRepository.createComment(userId, createCommentDto);

      return comment;
    } catch (error) {
      this.logger.error('Error adding comment', error, CommentService.name);
      throw error;
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
