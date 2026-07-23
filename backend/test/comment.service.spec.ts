import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from '../src/modules/comment/comment.service';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from '../src/modules/comment/dto/create-comment.dto';
import { TaskRepository } from 'src/modules/repository/task.repository';

describe('CommentService', () => {
  let service: CommentService;
  let commentRepository: jest.Mocked<CommentRepository>;
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
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CaseRepository,
          useValue: { findCaseById: jest.fn() },
        },
        {
          provide: TaskRepository,
          useValue: { findTaskById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    commentRepository = module.get(CommentRepository);
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
      commentRepository.createComment.mockResolvedValue(mockComment);

      const result = await service.addComment(createCommentDto, 'user-123');

      expect(result).toEqual(mockComment);
      expect(result.note).toBe('Test comment');
      expect(result.user_id).toBe('user-123');
      expect(result.case_id).toBe(1);
      expect(commentRepository.createComment).toHaveBeenCalledWith('user-123', createCommentDto);
      expect(loggerService.log).toHaveBeenCalledWith('Adding comment : user-123', CommentService.name);
    });

    it('should successfully add a comment with taskId', async () => {
      const taskCommentDto = { tenantId: 'tenant-123', taskId: 5, note: 'Task comment' };
      const taskComment = { ...mockComment, task_id: 5, case_id: null };
      commentRepository.createComment.mockResolvedValue(taskComment);

      const result = await service.addComment(taskCommentDto as any, 'user-123');

      expect(result).toEqual(taskComment);
      expect(commentRepository.createComment).toHaveBeenCalledWith('user-123', taskCommentDto);
    });

    it.each([
      ['neither caseId nor taskId', { tenantId: 'tenant-123', note: 'Test' }, 'Either caseId or taskId must be provided'],
      ['tenantId missing', { caseId: 1, note: 'Test' }, 'tenantId is required'],
    ])('should throw BadRequestException when %s', async (_desc, invalidDto, expectedMessage) => {
      await expect(service.addComment(invalidDto as any, 'user-123')).rejects.toThrow(new BadRequestException(expectedMessage));
      expect(commentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      commentRepository.createComment.mockRejectedValue(new Error('Database error'));

      await expect(service.addComment(createCommentDto, 'user-123')).rejects.toThrow('Database error');

      expect(loggerService.error).toHaveBeenCalledWith('Error adding comment', expect.any(Error), CommentService.name);
    });

    it('should allow both caseId and taskId if provided', async () => {
      const bothDto = { tenantId: 'tenant-123', caseId: 1, taskId: 5, note: 'Comment for both' };
      commentRepository.createComment.mockResolvedValue(mockComment);

      const result = await service.addComment(bothDto as any, 'user-123');

      expect(result).toEqual(mockComment);
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it.each([
      ['empty note', ''],
      ['very long note', 'a'.repeat(5000)],
    ])('should handle %s', async (_desc, noteValue) => {
      const dto = { ...createCommentDto, note: noteValue };
      commentRepository.createComment.mockResolvedValue({ ...mockComment, note: noteValue });

      const result = await service.addComment(dto, 'user-123');

      expect(result.note).toBe(noteValue);
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it('should pass tenantId to repository for tenant isolation', async () => {
      commentRepository.createComment.mockResolvedValue(mockComment);

      await service.addComment(createCommentDto, 'user-123');

      expect(commentRepository.createComment).toHaveBeenCalledWith('user-123', expect.objectContaining({ tenantId: 'tenant-123' }));
    });
  });

  describe('getComment', () => {
    it('should successfully retrieve a comment', async () => {
      commentRepository.getCommentsByCommentId.mockResolvedValue(mockComment);

      const result = await service.getComment(1, 'user-123', 'tenant-123');

      expect(result).toEqual(mockComment);
      expect(commentRepository.getCommentsByCommentId).toHaveBeenCalledWith(1, 'tenant-123');
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepository.getCommentsByCommentId.mockResolvedValue(null);

      await expect(service.getComment(999, 'user-123', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should handle repository errors', async () => {
      commentRepository.getCommentsByCommentId.mockRejectedValue(new Error('Database error'));

      await expect(service.getComment(1, 'user-123', 'tenant-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalledWith('Error retrieving comment', expect.any(Error), CommentService.name);
    });

    it('should log retrieval attempt', async () => {
      commentRepository.getCommentsByCommentId.mockResolvedValue(mockComment);

      await service.getComment(1, 'user-123', 'tenant-123');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', CommentService.name);
    });
  });

  describe('getCommentsByCaseOrTask', () => {
    it.each([
      ['caseId', 1, undefined, 'getCommentsByCaseId', 'case ID: 1'],
      ['taskId', undefined, 5, 'getCommentsByTaskId', 'task ID: 5'],
    ])('should retrieve comments by %s', async (_desc, caseId, taskId, repoMethod, expectedMessage) => {
      commentRepository[repoMethod].mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(caseId, taskId, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository[repoMethod]).toHaveBeenCalledWith(caseId ?? taskId);
    });

    it.each([
      ['neither caseId nor taskId provided', undefined, undefined, 'Either caseId or taskId must be provided'],
      ['both caseId and taskId provided', 1, 5, 'Cannot provide both caseId and taskId'],
    ])('should throw BadRequestException when %s', async (_desc, caseId, taskId, expectedMessage) => {
      await expect(service.getCommentsByCaseOrTask(caseId, taskId, 'user-123')).rejects.toThrow(new BadRequestException(expectedMessage));
    });

    it('should work without userId', async () => {
      commentRepository.getCommentsByCaseId.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseOrTask(1, undefined);

      expect(result).toEqual(mockComments);
    });

    it.each([
      ['case', 1, undefined, 'getCommentsByCaseId'],
      ['task', undefined, 5, 'getCommentsByTaskId'],
    ])('should handle repository errors for %s', async (_desc, caseId, taskId, repoMethod) => {
      commentRepository[repoMethod].mockRejectedValue(new Error('Database error'));

      await expect(service.getCommentsByCaseOrTask(caseId, taskId, 'user-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should return empty array when no comments found', async () => {
      commentRepository.getCommentsByCaseId.mockResolvedValue([]);

      const result = await service.getCommentsByCaseOrTask(1, undefined, 'user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getCommentsByCaseId', () => {
    it('should successfully retrieve comments by caseId', async () => {
      commentRepository.getCommentsByCaseId.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseId(1, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalledWith(1);
    });

    it('should work without userId', async () => {
      commentRepository.getCommentsByCaseId.mockResolvedValue(mockComments);

      const result = await service.getCommentsByCaseId(1);

      expect(result).toEqual(mockComments);
    });

    it('should handle repository errors', async () => {
      commentRepository.getCommentsByCaseId.mockRejectedValue(new Error('Database error'));

      await expect(service.getCommentsByCaseId(1, 'user-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it.each([
      ['empty array', []],
      ['large caseId', 999999],
    ])('should handle %s when no comments found', async (_desc, input) => {
      const caseId = typeof input === 'number' ? input : 1;
      const expectedResult = Array.isArray(input) ? input : [];
      commentRepository.getCommentsByCaseId.mockResolvedValue(expectedResult);

      const result = await service.getCommentsByCaseId(caseId, 'user-123');

      expect(commentRepository.getCommentsByCaseId).toHaveBeenCalledWith(caseId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getCommentsByTaskId', () => {
    it('should successfully retrieve comments by taskId', async () => {
      commentRepository.getCommentsByTaskId.mockResolvedValue(mockComments);

      const result = await service.getCommentsByTaskId(5, 'user-123');

      expect(result).toEqual(mockComments);
      expect(commentRepository.getCommentsByTaskId).toHaveBeenCalledWith(5);
    });

    it('should work without userId', async () => {
      commentRepository.getCommentsByTaskId.mockResolvedValue(mockComments);

      const result = await service.getCommentsByTaskId(5);

      expect(result).toEqual(mockComments);
    });

    it('should handle repository errors', async () => {
      commentRepository.getCommentsByTaskId.mockRejectedValue(new Error('Database error'));

      await expect(service.getCommentsByTaskId(5, 'user-123')).rejects.toThrow(Error);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it.each([
      ['empty array', []],
      ['large taskId', 999999],
    ])('should handle %s when no comments found', async (_desc, input) => {
      const taskId = typeof input === 'number' ? input : 5;
      const expectedResult = Array.isArray(input) ? input : [];
      commentRepository.getCommentsByTaskId.mockResolvedValue(expectedResult);

      const result = await service.getCommentsByTaskId(taskId, 'user-123');

      expect(commentRepository.getCommentsByTaskId).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });

    it('should log retrieval attempt', async () => {
      commentRepository.getCommentsByTaskId.mockResolvedValue(mockComments);

      await service.getCommentsByTaskId(5, 'user-123');

      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comments by taskId: ', CommentService.name);
    });
  });
});
