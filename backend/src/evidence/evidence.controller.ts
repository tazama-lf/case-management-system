import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Res,
  Req,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto } from './dto';

@ApiTags('Evidence')
@Controller('api/v1/evidence')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class EvidenceController {
  constructor(private evidenceService: EvidenceService) {}

  @Post('upload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Upload evidence for a case' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Evidence file to upload',
        },
        taskId: {
          type: 'string',
          description: 'Task ID',
        },
        type: {
          type: 'string',
          enum: ['DOCUMENT', 'SCREENSHOT', 'LOG', 'VIDEO', 'AUDIO', 'IMAGE', 'OTHER'],
          description: 'Type of evidence',
        },
        tags: {
          type: 'string',
          description: 'Tags (comma-separated)',
        },
        description: {
          type: 'string',
          description: 'Description of evidence',
        },
        comments: {
          type: 'string',
          description: 'Additional comments',
        },
      },
      required: ['file', 'taskID', 'type'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Evidence uploaded successfully',
    type: EvidenceResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadEvidence(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: any,
    @Body() dto: UploadEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EvidenceResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const userId = req.user?.token?.clientId || 'system';
    const tenantId = req.user?.token?.tenantId || 'DEFAULT';
    return this.evidenceService.uploadEvidence(file, dto, userId, tenantId);
  }

  @Get('task/:taskId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get all evidence for a case' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByCase(@Param('taskId') taskId: string, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
    const userId = req.user?.token?.clientId || 'system';
    return this.evidenceService.getEvidenceByTaskId(taskId, userId);
  }
  // @Get('case/:caseId')
  // @RequireInvestigatorOrSupervisorRole()
  // @ApiOperation({ summary: 'Get all evidence for a case' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'List of evidence retrieved successfully',
  //   type: EvidenceListResponseDto,
  // })
  // async getEvidenceByCase(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
  //   const userId = req.user?.token?.clientId || 'system';
  //   return this.evidenceService.getEvidenceByCase(caseId, userId);
  // }

  @Get(':id')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get evidence by ID' })
  @ApiResponse({
    status: 200,
    description: 'Evidence metadata retrieved successfully',
    type: EvidenceResponseDto,
  })
  async getEvidenceById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<EvidenceResponseDto> {
    const userId = req.user?.token?.clientId || 'system';
    return this.evidenceService.getEvidenceById(id, userId);
  }

  @Get(':id/download')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Download evidence file' })
  @ApiResponse({
    status: 200,
    description: 'Evidence file downloaded successfully',
  })
  async downloadEvidence(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const userId = req.user?.token?.clientId || 'system';
    const { file, metadata } = await this.evidenceService.downloadEvidence(id, userId);

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.fileName}"`);
    res.setHeader('Content-Length', metadata.fileSize);
    res.setHeader('X-Evidence-Hash', metadata.hash);

    res.send(file);
  }

  @Get(':id/verify')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Verify evidence integrity' })
  @ApiResponse({
    status: 200,
    description: 'Evidence integrity verified',
    type: VerifyEvidenceDto,
  })
  async verifyEvidence(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<VerifyEvidenceDto> {
    const userId = req.user?.token?.clientId || 'system';
    return this.evidenceService.verifyEvidence(id, userId);
  }
}
