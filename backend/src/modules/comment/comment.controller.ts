import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TazamaAuthGuard } from 'src/modules/auth/tazama-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentService } from './comment.service';
import { AuthenticatedRequest } from 'src/modules/auth/auth.types';
import { RequireInvestigatorOrSupervisorRole } from 'src/modules/auth/auth.decorator';

@Controller('api/v1/comment')
@UseGuards(TazamaAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @RequireInvestigatorOrSupervisorRole()
  async addComment(@Body() createCommentDto: CreateCommentDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.commentService.addComment(createCommentDto, userId);
  }

  @Get(':commentId')
  @RequireInvestigatorOrSupervisorRole()
  async getComment(@Param('commentId') commentId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.commentService.getComment(commentId, userId);
  }

  @Get()
  @RequireInvestigatorOrSupervisorRole()
  async getCommentsByCaseOrTask(@Req() req: AuthenticatedRequest, @Query('caseId') caseId?: string, @Query('taskId') taskId?: string) {
    const userId = req?.user.token.clientId;
    return this.commentService.getCommentsByCaseOrTask(caseId, taskId, userId);
  }

 @Get('/case/:caseId/comment')
 @RequireInvestigatorOrSupervisorRole()
  async getCommentsByCaseId(@Param('caseId') caseId: string , @Req() req: AuthenticatedRequest) {
    return this.commentService.getCommentsByCaseId(caseId);
  }

  @Get('/task/:taskId/comment')
  @RequireInvestigatorOrSupervisorRole()
  async getCommentsByTaskId(@Param('taskId') caseId: string , @Req() req: AuthenticatedRequest) {
    return this.commentService.getCommentsByTaskId(caseId);
  }

}
