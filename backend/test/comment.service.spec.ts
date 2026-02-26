import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from '../src/modules/comment/comment.service';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from '../src/modules/comment/dto/create-comment.dto';
import { Outcome } from '../src/utils/types/outcome';

describe('CommentService', () => {
  let service: CommentService;
  let commentRepository: jest.Mocked<CommentRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockComment = {
    comment_id: 1,
    tenant_id: 'tenant-123',
    user_id: 'user-123',
    case_id: 1,
    task_id: null,
    note: 'Test comment',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockComments = [
    mockComment,
    {
      comment_id: 2,
      tenant_id: 'tenant-123',
      user_id: 'user-456',
      case_id: 1,
      task_id: null,
      note: 'Another comment',
      created_at: new Date('2026-01-02'),
      updated_at: new Date('2026-01-02'),
    },
  ];

  beforeEach(async () => {
    const mockCommentRepository = {
      createComment: jest.fn(),
      getCommentsByCommentId: jest.fn(),
      getCommentsByCaseId: jest.fn(),
      getCommentsByTaskId: jest.fn(),
    };

    const mockAuditLogService = {
      logAction: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: CommentRepository,
          useValue: mockCommentRepository,
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
    commentRepository = module.get(CommentRepository);
    auditLogService = module.get(AuditLogService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addComment', () => {
    const createCommentDto: CreateCommentDto = {
      tenantId: 'tenant-123',
      caseId: 1,
      note: 'Test comment',
    };

    it('should successfully add a comment with caseId', async () => {
      (commentRepository.createComment as jest.Mock).mockResolvedValue(mockComment);

      const result = await service.addComment(createCommentDto, 'user-123');

      expect(result).toBeDefined();
      expect(result).toEqual(mockComment);
      expect(result!.note).toBe('Test comment');
      expect(result!.user_id).toBe('user-123');
      expect(result!.case_id).toBe(1);
      expect(commentRepository.createComment).toHaveBeenCalledWith('user-123', createCommentDto);
      
      // Verify audit log with timestamp within last 5 seconds
      const auditCall = (auditLogService.logAction as jest.Mock).mock.calls[0][0];
      expect(auditCall.userId).toBe('user-123');
      expect(auditCall.operation).toBe('addComment');
      expect(auditCall.outcome).toBe(Outcome.SUCCESS);
      expect(auditCall.performedAt).toBeInstanceOf(Date);
      expect(Date.now() - auditCall.performedAt.getTime()).toBeLessThan(5000);
      
      expect(loggerService.log).toHaveBeenCalledWith('Adding comment : user-123', CommentService.name);
    });

    it('should successfully add a comment with taskId', async () => {
      const taskCommentDto = {
        tenantId: 'tenant-123',
        taskId: 5,
        note: 'Task comment',
      };
      const taskComment = { ...mockComment, task_id: 5, case_id: null };
      (commentRepository.createComment as jest.Mock).mockResolvedValue(taskComment);

      const result = await service.addComment(taskCommentDto as any, 'user-123');

      expect(result).toEqual(taskComment);
      expect(commentRepository.createComment).toHaveBeenCalledWith('user-123', taskCommentDto);
    });

    it('should throw BadRequestException if neither caseId nor taskId provided', async () => {
      const invalidDto = {
        tenantId: 'tenant-123',
        note: 'Test comment',
      };

      await expect(service.addComment(invalidDto as any, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(commentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if tenantId is missing', async () => {
      const invalidDto = {
        caseId: 1,
        note: 'Test comment',
      };

      await expect(service.addComment(invalidDto as any, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(commentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      (commentRepository.createComment as jest.Mock).mockRejectedValue(new Error('Database error'));

      await service.addComment(createCommentDto, 'user-123');

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error adding comment',
        expect.any(Error),
        CommentService.name,
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
          operation: 'addComment',
        }),
      );
    });

    it('should allow both caseId and taskId if provided', async () => {
      const bothDto = {
        tenantId: 'tenant-123',
        caseId: 1,
        taskId: 5,
        note: 'Comment for both',
      };
      (commentRepository.createComment as jest.Mock).mockResolvedValue(mockComment);

      const result = await service.addComment(bothDto as any, 'user-123');

      expect(result).toEqual(mockComment);
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it('should handle empty note', async () => {
      const emptyNoteDto = {
        ...createCommentDto,
        note: '',
      };
      (commentRepository.createComment as jest.Mock).mockResolvedValue({
        ...mockComment,
        note: '',
      });

      const result = await service.addComment(emptyNoteDto, 'user-123');

      expect(result).toBeDefined();
      expect(result!.note).toBe('');
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it('should handle very long notes correctly', async () => {
      const longNote = 'a'.repeat(5000);
      const longNoteDto = {
        ...createCommentDto,
        note: longNote,
      };
      (commentRepository.createComment as jest.Mock).mockResolvedValue({
        ...mockComment,
        note: longNote,
      });

      const result = await service.addComment(longNoteDto, 'user-123');

      expect(result).toBeDefined();
      expect(result!.note).toBe(longNote);
      expect(result!.note.length).toBe(5000);
    });

    it('should pass tenantId to repository for tenant isolation', async () => {
      (commentRepository.createComment as jest.Mock).mockResolvedValue(mockComment);

      await service.addComment(createCommentDto, 'user-123');

      expect(commentRepository.createComment).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          tenantId: 'tenant-123',
        }),
      );
    });
  });

  describe('getComment', () => {
    it('should successfully retrieve a comment', async () => {
      (commentRepository.getCommentsByCommentId as jest.Mock).mockResolvedValue(mockComment);

      const result = await service.getComment(1, 'user-123', 'tenant-123');

      expect(result).toEqual(mockComment);
      expect(commentRepository.getCommentsByCommentId).toHaveBeenCalledWith(1, 'tenant-123');
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'user-123',
        operation: 'getComment',
        entityName: CommentService.name,
        actionPerformed: 'Successfully retrieved comment with ID: 1',
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException when comment not found', async () => {
      (commentRepository.getCommentsByCommentId as jest.Mock).mockResolvedValue(null);

      await expect(service.getComment(999, 'user-123', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
          operation: 'getComment',
        }),
      );
    });

    it('should handle repository errors', async () => {
      (commentRepository.getCommentsByCommentId as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getComment(1, 'user-123', 'tenant-123')).rejects.toThrow(
        Error,
      );
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error retrieving comment',
        expect.any(Error),
        CommentService.name,
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should log retrieval attempt', async () => {
      (commentRepository.getCommentsByCommentId as jest.Mock).mockResolvedValue(mockComment);

      await service.getComment(1, 'user-123', 'tenant-123');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', CommentService.name);
    });
  });

  describe('getCommentsByCaseOrTask', () => {
    it('should retrieve comments by caseId', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(1, undefined, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalledWith(1);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'Successfully retrieved comments for case ID: 1',
          outcome: Outcome.SUCCESS,
        }),
      );
    });

    it('should retrieve comments by taskId', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(undefined, 5, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByTaskId).toHaveBeenCalledWith(5);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'Successfully retrieved comments for task ID: 5',
          outcome: Outcome.SUCCESS,
        }),
      );
    });

    it('should throw BadRequestException if neither caseId nor taskId provided', async () => {
      await expect(service.getCommentsByCaseOrTask(undefined, undefined, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if both caseId and taskId provided', async () => {
      await expect(service.getCommentsByCaseOrTask(1, 5, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should work without userId (no audit logging)', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(1, undefined);

      expect(result).toEqual(mockComments);
      expect(auditLogService.logAction).not.toHaveBeenCalled();
    });

    it('should handle repository errors for case', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCommentsByCaseOrTask(1, undefined, 'user-123')).rejects.toThrow(
        Error,
      );
      expect(loggerService.error).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should handle repository errors for task', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCommentsByCaseOrTask(undefined, 5, 'user-123')).rejects.toThrow(
        Error,
      );
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should return empty array when no comments found', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue([]);

      const result = await service.getCommentsByCaseOrTask(1, undefined, 'user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getCommentsByCaseId', () => {
    it('should successfully retrieve comments by caseId', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseId(1, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalledWith(1);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'Successfully retrieved comments for case ID: 1',
          outcome: Outcome.SUCCESS,
        }),
      );
    });

    it('should work without userId', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseId(1);

      expect(result).toEqual(mockComments);
      expect(auditLogService.logAction).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCommentsByCaseId(1, 'user-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should return empty array when no comments found', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue([]);

      const result = await service.getCommentsByCaseId(1, 'user-123');

      expect(result).toEqual([]);
    });

    it('should handle large caseId', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue([]);

      const result = await service.getCommentsByCaseId(999999, 'user-123');

      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalledWith(999999);
      expect(result).toEqual([]);
    });
  });

  describe('getCommentsByTaskId', () => {
    it('should successfully retrieve comments by taskId', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByTaskId(5, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByTaskId).toHaveBeenCalledWith(5);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionPerformed: 'Successfully retrieved comments for task ID: 5',
          outcome: Outcome.SUCCESS,
        }),
      );
    });

    it('should work without userId', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByTaskId(5);

      expect(result).toEqual(mockComments);
      expect(auditLogService.logAction).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCommentsByTaskId(5, 'user-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should return empty array when no comments found', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue([]);

      const result = await service.getCommentsByTaskId(5, 'user-123');

      expect(result).toEqual([]);
    });

    it('should handle large taskId', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue([]);

      const result = await service.getCommentsByTaskId(999999, 'user-123');

      expect(commentRepository.getCommentsByTaskId).toHaveBeenCalledWith(999999);
      expect(result).toEqual([]);
    });

    it('should log retrieval attempt', async () => {
      (commentRepository.getCommentsByTaskId as jest.Mock).mockResolvedValue(mockComments);

      await service.getCommentsByTaskId(5, 'user-123');

      expect(loggerService.log).toHaveBeenCalledWith(
        'Retrieving comments by taskId: ',
        CommentService.name,
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple operations in sequence', async () => {
      const createDto: CreateCommentDto = {
        tenantId: 'tenant-123',
        caseId: 1,
        note: 'Test comment',
      };

      (commentRepository.createComment as jest.Mock).mockResolvedValue(mockComment);
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue([mockComment]);

      await service.addComment(createDto, 'user-123');
      const comments = await service.getCommentsByCaseId(1, 'user-123');

      expect(comments).toEqual([mockComment]);
      expect(commentRepository.createComment).toHaveBeenCalled();
      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalled();
    });

    it('should handle mixed success and failure scenarios', async () => {
      const createDto: CreateCommentDto = {
        tenantId: 'tenant-123',
        caseId: 1,
        note: 'Test comment',
      };

      (commentRepository.createComment as jest.Mock).mockResolvedValue(mockComment);
      (commentRepository.getCommentsByCommentId as jest.Mock).mockResolvedValue(null);

      await service.addComment(createDto, 'user-123');
      await expect(service.getComment(999, 'user-123', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );

      expect(auditLogService.logAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle null values gracefully in dto', async () => {
      const createDto: any = {
        tenantId: 'tenant-123',
        caseId: 1,
        note: null,
      };

      (commentRepository.createComment as jest.Mock).mockResolvedValue({
        ...mockComment,
        note: null,
      });

      const result = await service.addComment(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(result!.note).toBeNull();
    });

    it('should handle undefined repository responses', async () => {
      (commentRepository.getCommentsByCaseId as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getCommentsByCaseId(1, 'user-123');

      expect(result).toBeUndefined();
    });

    it('should handle very long notes', async () => {
      const longNote = 'a'.repeat(10000);
      const createDto: CreateCommentDto = {
        tenantId: 'tenant-123',
        caseId: 1,
        note: longNote,
      };

      (commentRepository.createComment as jest.Mock).mockResolvedValue({
        ...mockComment,
        note: longNote,
      });

      const result = await service.addComment(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(result!.note).toEqual(longNote);
    });
  });
});
