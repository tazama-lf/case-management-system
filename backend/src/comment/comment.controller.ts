import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentService } from './comment.service';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import { RequireCMSTestRole } from 'src/auth/auth.decorator';

@Controller('api/v1/comment')
@UseGuards(TazamaAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @RequireCMSTestRole()
  async addComment(@Body() createCommentDto: CreateCommentDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.commentService.addComment(createCommentDto, userId);
  }

  @Get(':commentId')
  @RequireCMSTestRole()
  async getComment(@Param('commentId') commentId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return this.commentService.getComment(commentId, userId);
  }

  @Get()
  @RequireCMSTestRole()
  async getCommentsByCaseOrTask(@Req() req: AuthenticatedRequest, @Query('caseId') caseId?: string, @Query('taskId') taskId?: string) {
    const userId = req?.user.token.clientId;
    return this.commentService.getCommentsByCaseOrTask(caseId, taskId, userId);
  }
}
