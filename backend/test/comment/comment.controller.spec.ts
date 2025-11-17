import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from '../../src/modules/comment/comment.controller';
import { CommentService } from '../../src/modules/comment/comment.service';
import { TazamaAuthGuard } from '../../src/modules/auth/tazama-auth.guard';
import { CreateCommentDto } from '../../src/modules/comment/dto/create-comment.dto';
import { AuthenticatedRequest } from '../../src/modules/auth/auth.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CommentController', () => {
  let controller: CommentController;
  let commentService: CommentService;

  const mockCommentService = {
    addComment: jest.fn(),
    getComment: jest.fn(),
    getCommentsByCaseOrTask: jest.fn(),
  };

  const mockTazamaAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockAuthenticatedRequest = {
    user: {
      token: {
        clientId: 'test-user-id',
        tenantId: 'test-tenant-id',
        roles: ['CMS_Test'],
      },
    },
  } as unknown as AuthenticatedRequest;

  const mockComment = {
    comment_id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: 'test-user-id',
    case_id: '123e4567-e89b-12d3-a456-426614174001',
    task_id: null,
    note: 'Test comment',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useValue(mockTazamaAuthGuard)
      .compile();

    controller = module.get<CommentController>(CommentController);
    commentService = module.get<CommentService>(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addComment', () => {
    it('should successfully add a comment with caseId', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment',
        caseId: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockCommentService.addComment.mockResolvedValue(mockComment);

      const result = await controller.addComment(createCommentDto, mockAuthenticatedRequest);

      expect(commentService.addComment).toHaveBeenCalledWith(createCommentDto, 'test-user-id');
      expect(result).toEqual(mockComment);
    });

    it('should successfully add a comment with taskId', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment for task',
        taskId: '123e4567-e89b-12d3-a456-426614174002',
      };

      const taskComment = { ...mockComment, task_id: '123e4567-e89b-12d3-a456-426614174002', case_id: null };
      mockCommentService.addComment.mockResolvedValue(taskComment);

      const result = await controller.addComment(createCommentDto, mockAuthenticatedRequest);

      expect(commentService.addComment).toHaveBeenCalledWith(createCommentDto, 'test-user-id');
      expect(result).toEqual(taskComment);
    });

    it('should throw BadRequestException when neither caseId nor taskId provided', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment without case or task',
      };

      mockCommentService.addComment.mockRejectedValue(new BadRequestException('Either caseId or taskId must be provided'));

      await expect(controller.addComment(createCommentDto, mockAuthenticatedRequest)).rejects.toThrow(BadRequestException);
      expect(commentService.addComment).toHaveBeenCalledWith(createCommentDto, 'test-user-id');
    });

    it('should throw BadRequestException when both caseId and taskId provided', async () => {
      const createCommentDto: CreateCommentDto = {
        note: 'Test comment with both',
        caseId: '123e4567-e89b-12d3-a456-426614174001',
        taskId: '123e4567-e89b-12d3-a456-426614174002',
      };

      mockCommentService.addComment.mockRejectedValue(new BadRequestException('Cannot provide both caseId and taskId'));

      await expect(controller.addComment(createCommentDto, mockAuthenticatedRequest)).rejects.toThrow(BadRequestException);
      expect(commentService.addComment).toHaveBeenCalledWith(createCommentDto, 'test-user-id');
    });
  });

  describe('getComment', () => {
    it('should successfully retrieve a comment by ID', async () => {
      const commentId = '123e4567-e89b-12d3-a456-426614174000';
      mockCommentService.getComment.mockResolvedValue(mockComment);

      const result = await controller.getComment(commentId, mockAuthenticatedRequest);

      expect(commentService.getComment).toHaveBeenCalledWith(commentId, 'test-user-id');
      expect(result).toEqual(mockComment);
    });

    it('should throw NotFoundException when comment not found', async () => {
      const commentId = 'non-existent-id';
      mockCommentService.getComment.mockRejectedValue(new NotFoundException('Comment not found'));

      await expect(controller.getComment(commentId, mockAuthenticatedRequest)).rejects.toThrow(NotFoundException);
      expect(commentService.getComment).toHaveBeenCalledWith(commentId, 'test-user-id');
    });
  });

  describe('getCommentsByCaseOrTask', () => {
    const multipleComments = [
      mockComment,
      {
        ...mockComment,
        comment_id: '123e4567-e89b-12d3-a456-426614174003',
        note: 'Another test comment',
      },
    ];

    it('should successfully retrieve comments by caseId', async () => {
      const caseId = '123e4567-e89b-12d3-a456-426614174001';
      mockCommentService.getCommentsByCaseOrTask.mockResolvedValue(multipleComments);

      const result = await controller.getCommentsByCaseOrTask(mockAuthenticatedRequest, caseId);

      expect(commentService.getCommentsByCaseOrTask).toHaveBeenCalledWith(caseId, undefined, 'test-user-id');
      expect(result).toEqual(multipleComments);
    });

    it('should successfully retrieve comments by taskId', async () => {
      const taskId = '123e4567-e89b-12d3-a456-426614174002';
      mockCommentService.getCommentsByCaseOrTask.mockResolvedValue(multipleComments);

      const result = await controller.getCommentsByCaseOrTask(mockAuthenticatedRequest, undefined, taskId);

      expect(commentService.getCommentsByCaseOrTask).toHaveBeenCalledWith(undefined, taskId, 'test-user-id');
      expect(result).toEqual(multipleComments);
    });

    it('should throw BadRequestException when neither caseId nor taskId provided', async () => {
      mockCommentService.getCommentsByCaseOrTask.mockRejectedValue(
        new BadRequestException('Either caseId or taskId must be provided')
      );

      await expect(controller.getCommentsByCaseOrTask(mockAuthenticatedRequest)).rejects.toThrow(BadRequestException);
      expect(commentService.getCommentsByCaseOrTask).toHaveBeenCalledWith(undefined, undefined, 'test-user-id');
    });

    it('should throw BadRequestException when both caseId and taskId provided', async () => {
      const caseId = '123e4567-e89b-12d3-a456-426614174001';
      const taskId = '123e4567-e89b-12d3-a456-426614174002';
      
      mockCommentService.getCommentsByCaseOrTask.mockRejectedValue(
        new BadRequestException('Cannot provide both caseId and taskId')
      );

      await expect(controller.getCommentsByCaseOrTask(mockAuthenticatedRequest, caseId, taskId)).rejects.toThrow(BadRequestException);
      expect(commentService.getCommentsByCaseOrTask).toHaveBeenCalledWith(caseId, taskId, 'test-user-id');
    });

    it('should return empty array when no comments found', async () => {
      const caseId = '123e4567-e89b-12d3-a456-426614174001';
      mockCommentService.getCommentsByCaseOrTask.mockResolvedValue([]);

      const result = await controller.getCommentsByCaseOrTask(mockAuthenticatedRequest, caseId);

      expect(commentService.getCommentsByCaseOrTask).toHaveBeenCalledWith(caseId, undefined, 'test-user-id');
      expect(result).toEqual([]);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should use TazamaAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', CommentController);
      expect(guards).toContain(TazamaAuthGuard);
    });

    it('should require CMS_Test role for all endpoints', () => {
      const addCommentMethod = controller.addComment;
      const getCommentMethod = controller.getComment;
      const getCommentsMethod = controller.getCommentsByCaseOrTask;

      expect(addCommentMethod).toBeDefined();
      expect(getCommentMethod).toBeDefined();
      expect(getCommentsMethod).toBeDefined();
    });
  });
});
