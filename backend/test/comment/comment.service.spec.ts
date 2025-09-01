import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from '../../src/comment/comment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';

describe('CommentService', () => {
  let service: CommentService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockComment = {
    comment_id: 'test-comment-1',
    comment_text: 'Test comment',
    comment_author: 'test-user',
    created_at: new Date(),
    updated_at: new Date(),
    case_id: 'test-case-1',
    alert_id: null,
  };

  beforeEach(async () => {
    mockPrismaService = {
      comment: {
        findMany: jest.fn().mockResolvedValue([mockComment]),
        findUnique: jest.fn().mockResolvedValue(mockComment),
        create: jest.fn().mockResolvedValue(mockComment),
        update: jest.fn().mockResolvedValue(mockComment),
        delete: jest.fn().mockResolvedValue(mockComment),
      },
    } as any;

    mockAuditLogService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all comments', async () => {
      const result = await service.findAll();

      expect(result).toEqual([mockComment]);
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPrismaService.comment.findMany.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a comment by id', async () => {
      const result = await service.findOne('test-comment-1');

      expect(result).toEqual(mockComment);
      expect(mockPrismaService.comment.findUnique).toHaveBeenCalledWith({
        where: { comment_id: 'test-comment-1' },
      });
    });

    it('should return null for non-existent comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new comment', async () => {
      const createCommentDto = {
        comment_text: 'New comment',
        case_id: 'test-case-1',
      };

      const result = await service.create(createCommentDto, 'test-user');

      expect(result).toEqual(mockComment);
      expect(mockPrismaService.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment_text: createCommentDto.comment_text,
          case_id: createCommentDto.case_id,
          comment_author: 'test-user',
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a comment', async () => {
      const updateData = {
        comment_text: 'Updated comment',
      };

      const result = await service.update('test-comment-1', updateData, 'test-user');

      expect(result).toEqual(mockComment);
      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { comment_id: 'test-comment-1' },
        data: expect.objectContaining({
          comment_text: updateData.comment_text,
          updated_at: expect.any(Date),
        }),
      });
    });
  });

  describe('remove', () => {
    it('should delete a comment', async () => {
      const result = await service.remove('test-comment-1', 'test-user');

      expect(result).toEqual(mockComment);
      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { comment_id: 'test-comment-1' },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        'test-user',
        'DELETE_COMMENT',
        'Comment',
        'test-comment-1'
      );
    });
  });
});
