import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CommentRepository } from '../repository/comment.repository';
import { CaseRepository } from '../repository/case.repository';
import { Comment } from '@prisma/client-cms';
import { RbacService, EndpointKey } from '../../utils/rbac/rbacHelper';
import type { AuthenticatedUser } from '../../utils/types/auth.types';
import { TaskRepository } from '../repository/task.repository';

@Injectable()
export class CommentService {
  private readonly rbacService = new RbacService();

  constructor(
    private readonly logger: LoggerService,
    private readonly commentRepository: CommentRepository,
    private readonly caseRepository: CaseRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async addCommentFromController(
    createCommentDto: CreateCommentDto,
    userId: string,
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
  ): Promise<Comment> {
    this.logger.log(`Adding comment : ${userId}`, CommentService.name);

    if (!createCommentDto.caseId && !createCommentDto.taskId) {
      throw new BadRequestException('Either caseId or taskId must be provided');
    }

    // Use user.tenantId for all tenant-scoped lookups (not the DTO)
    const { tenantId } = user;

    let caseId: number;
    if (createCommentDto.caseId) {
      caseId = createCommentDto.caseId;
    } else {
      // Resolve case via task (createCommentDto.taskId must be present due to guard above)
      const task = await this.taskRepository.findTaskById(createCommentDto.taskId!, tenantId);
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      caseId = task.case_id;
    }

    const existingCase = await this.caseRepository.findCaseById(caseId, tenantId);
    const rbacRole = this.rbacService.getRoleFromUser(user);
    const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: existingCase.status });
    if (!t2.allowed) throw new ForbiddenException(t2.reason);

    try {
      const comment = await this.commentRepository.createComment(userId, createCommentDto);

      return comment;
    } catch (error) {
      this.logger.error('Error adding comment', error, CommentService.name);
      throw error;
    }
  }

  async addComment(createCommentDto: CreateCommentDto, userId: string): Promise<Comment> {
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
