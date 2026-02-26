import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentService } from './comment.service';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { Comment } from '@prisma/client-cms';
import { Audit } from '../audit/decorators/audit-log.decorator';

@Controller('api/v1/comment')
@UseGuards(TazamaAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  async addComment(@Body() createCommentDto: CreateCommentDto, @Req() req: AuthenticatedRequest): Promise<Comment | void> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return await this.commentService.addComment(createCommentDto, userId);
  }

  @Get(':commentId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async getComment(@Param('commentId') commentId: number, @Req() req: AuthenticatedRequest): Promise<Comment> {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    return await this.commentService.getComment(commentId, userId, tenantId);
  }

  @Get()
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async getCommentsByCaseOrTask(
    @Req() req: AuthenticatedRequest,
    @Query('caseId') caseId?: number,
    @Query('taskId') taskId?: number,
  ): Promise<Comment[]> {
    const userId = req.user.token.clientId;
    return await this.commentService.getCommentsByCaseOrTask(caseId, taskId, userId);
  }

  @Get('/case/:caseId/comment')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async getCommentsByCaseId(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<Comment[]> {
    return await this.commentService.getCommentsByCaseId(caseId);
  }

  @Get('/task/:taskId/comment')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async getCommentsByTaskId(@Param('taskId') taskId: number, @Req() req: AuthenticatedRequest): Promise<Comment[]> {
    const userId = req.user.token.clientId;
    return await this.commentService.getCommentsByTaskId(taskId, userId);
  }
}
