/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommentService } from '../../src/modules/comment/comment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { CreateCommentDto } from '../../src/modules/comment/dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../src/modules/audit/types/outcome';

describe('CommentService', () => {
  let service: CommentService;
  let prismaService: PrismaService;
  let auditLogService: AuditLogService;
  let loggerService: LoggerService;

  const mockPrismaService = {
    comment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const userId = 'test-user-id';

  describe('addComment', () => {
    it('should return undefined and log error when neither caseId nor taskId provided', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment without ids',
      };

      const result = await service.addComment(createCommentDto, userId);
      expect(result).toBeUndefined();

      expect(loggerService.log).toHaveBeenCalledWith(`Adding comment : ${userId}`, CommentService.name);
      expect(loggerService.error).toHaveBeenCalledWith('Error adding comment', expect.any(BadRequestException), CommentService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'addComment',
        entityName: CommentService.name,
        actionPerformed: `Attempt to write a comment: ${createCommentDto.note}`,
        outcome: 'FAILURE',
        performedAt: expect.any(Date),
      });
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('should return undefined and log error when both caseId and taskId provided', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment with both',
        caseId: '123e4567-e89b-12d3-a456-426614174001',
        taskId: '123e4567-e89b-12d3-a456-426614174002',
      };

      const result = await service.addComment(createCommentDto, userId);
      expect(result).toBeUndefined();

      expect(loggerService.log).toHaveBeenCalledWith(`Adding comment : ${userId}`, CommentService.name);
      expect(loggerService.error).toHaveBeenCalledWith('Error adding comment', expect.any(BadRequestException), CommentService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'addComment',
        entityName: CommentService.name,
        actionPerformed: `Attempt to write a comment: ${createCommentDto.note}`,
        outcome: 'FAILURE',
        performedAt: expect.any(Date),
      });
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('should successfully add comment with caseId', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment for case',
        caseId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const mockComment = {
        comment_id: 'comment-id-123',
        user_id: userId,
        case_id: createCommentDto.caseId,
        task_id: null,
        note: createCommentDto.note,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.comment.create.mockResolvedValue(mockComment);

      const result = await service.addComment(createCommentDto, userId);

      expect(result).toEqual(mockComment);
      expect(loggerService.log).toHaveBeenCalledWith(`Adding comment : ${userId}`, CommentService.name);
      expect(mockPrismaService.comment.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          case_id: createCommentDto.caseId,
          task_id: null,
          note: createCommentDto.note,
        },
      });
    });

    it('should successfully add comment with taskId', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment for task',
        taskId: '123e4567-e89b-12d3-a456-426614174002',
      };

      const mockComment = {
        comment_id: 'comment-id-456',
        user_id: userId,
        case_id: null,
        task_id: createCommentDto.taskId,
        note: createCommentDto.note,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.comment.create.mockResolvedValue(mockComment);

      const result = await service.addComment(createCommentDto, userId);

      expect(result).toEqual(mockComment);
      expect(loggerService.log).toHaveBeenCalledWith(`Adding comment : ${userId}`, CommentService.name);
      expect(mockPrismaService.comment.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          case_id: null,
          task_id: createCommentDto.taskId,
          note: createCommentDto.note,
        },
      });
    });

    it('should return undefined and log error when Prisma throws error', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment for case',
        caseId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const prismaError = new Error('Database connection failed');
      mockPrismaService.comment.create.mockRejectedValue(prismaError);

      const result = await service.addComment(createCommentDto, userId);

      expect(result).toBeUndefined();
      expect(loggerService.log).toHaveBeenCalledWith(`Adding comment : ${userId}`, CommentService.name);
      expect(loggerService.error).toHaveBeenCalledWith('Error adding comment', prismaError, CommentService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'addComment',
        entityName: CommentService.name,
        actionPerformed: `Attempt to write a comment: ${createCommentDto.note}`,
        outcome: 'FAILURE',
        performedAt: expect.any(Date),
      });
    });
  });

  describe('getComment', () => {
    const commentId = '123e4567-e89b-12d3-a456-426614174003';

    it('should successfully get comment', async () => {
      const mockComment = {
        comment_id: commentId,
        user_id: userId,
        case_id: '123e4567-e89b-12d3-a456-426614174001',
        task_id: null,
        note: 'Test comment',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.comment.findUnique.mockResolvedValue(mockComment);

      const result = await service.getComment(commentId, userId);

      expect(result).toEqual(mockComment);
      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', CommentService.name);
      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: {
          comment_id: commentId,
        },
      });
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getComment',
        entityName: CommentService.name,
        actionPerformed: `Successfully retrieved comment with ID: ${commentId}`,
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.getComment(commentId, userId)).rejects.toThrow(NotFoundException);
      await expect(service.getComment(commentId, userId)).rejects.toThrow('Comment not found');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', CommentService.name);
      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: {
          comment_id: commentId,
        },
      });
    });

    it('should handle and re-throw Prisma errors', async () => {
      const prismaError = new Error('Database connection failed');
      mockPrismaService.comment.findUnique.mockRejectedValue(prismaError);

      await expect(service.getComment(commentId, userId)).rejects.toThrow(prismaError);

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', CommentService.name);
      expect(loggerService.error).toHaveBeenCalledWith('Error retrieving comment', prismaError, CommentService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getComment',
        entityName: CommentService.name,
        actionPerformed: `Error retrieving comment with ID: ${commentId}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });
  });

  describe('getCommentsByCaseOrTask', () => {
    const caseId = '123e4567-e89b-12d3-a456-426614174001';
    const taskId = '123e4567-e89b-12d3-a456-426614174002';

    it('should throw BadRequestException when neither caseId nor taskId provided', async () => {
      await expect(service.getCommentsByCaseOrTask()).rejects.toThrow(BadRequestException);
      await expect(service.getCommentsByCaseOrTask()).rejects.toThrow('Either caseId or taskId must be provided');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
    });

    it('should throw BadRequestException when both caseId and taskId provided', async () => {
      await expect(service.getCommentsByCaseOrTask(caseId, taskId, userId)).rejects.toThrow(BadRequestException);
      await expect(service.getCommentsByCaseOrTask(caseId, taskId, userId)).rejects.toThrow('Cannot provide both caseId and taskId');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
    });

    it('should successfully get comments by caseId', async () => {
      const mockComments = [
        {
          comment_id: 'comment-1',
          user_id: userId,
          case_id: caseId,
          task_id: null,
          note: 'Test comment 1',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          comment_id: 'comment-2',
          user_id: userId,
          case_id: caseId,
          task_id: null,
          note: 'Test comment 2',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(caseId, undefined, userId);

      expect(result).toEqual(mockComments);
      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: { case_id: caseId },
        orderBy: {
          created_at: 'desc',
        },
      });
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getCommentsByCaseOrTask',
        entityName: CommentService.name,
        actionPerformed: `Successfully retrieved comments for case ID: ${caseId}`,
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should successfully get comments by taskId', async () => {
      const mockComments = [
        {
          comment_id: 'comment-3',
          user_id: userId,
          case_id: null,
          task_id: taskId,
          note: 'Test comment for task',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(undefined, taskId, userId);

      expect(result).toEqual(mockComments);
      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: { task_id: taskId },
        orderBy: {
          created_at: 'desc',
        },
      });
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getCommentsByCaseOrTask',
        entityName: CommentService.name,
        actionPerformed: `Successfully retrieved comments for task ID: ${taskId}`,
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should successfully get comments by caseId without userId for audit', async () => {
      const mockComments = [
        {
          comment_id: 'comment-4',
          user_id: 'another-user',
          case_id: caseId,
          task_id: null,
          note: 'Another test comment',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(caseId);

      expect(result).toEqual(mockComments);
      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: { case_id: caseId },
        orderBy: {
          created_at: 'desc',
        },
      });
      expect(auditLogService.logAction).not.toHaveBeenCalled();
    });

    it('should handle and re-throw Prisma errors', async () => {
      const prismaError = new Error('Database connection failed');
      mockPrismaService.comment.findMany.mockRejectedValue(prismaError);

      await expect(service.getCommentsByCaseOrTask(caseId, undefined, userId)).rejects.toThrow(prismaError);

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by case or task', CommentService.name);
      expect(loggerService.error).toHaveBeenCalledWith('Error retrieving comments', prismaError, CommentService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getCommentsByCaseOrTask',
        entityName: CommentService.name,
        actionPerformed: `Error retrieving comments for case ID: ${caseId}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });
  });
});
