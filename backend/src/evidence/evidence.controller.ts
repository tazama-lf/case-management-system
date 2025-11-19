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
  UploadedFiles,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole, TazamaClaims } from '../auth/auth.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto, EvidenceType } from './dto';

@ApiTags('Evidence')
@Controller('api/v1/evidence')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class EvidenceController {
  constructor(private evidenceService: EvidenceService) {}

  @Post('upload')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Upload evidence for a task' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        taskId: {
          type: 'string',
          description: 'Task ID',
        },
        evidenceType: {
          type: 'string',
          enum: ['ADVERSE_MEDIA', 'SANCTIONS', 'OTHER'],
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
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadEvidence(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    files: any[],
    @Body() dto: UploadEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EvidenceResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const { clientId, tenantId, claims } = req.user.token;
    return this.evidenceService.uploadEvidence(files, dto, clientId, tenantId);
  }

  @Get('task/:taskId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get all evidence for a task' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByTask(@Param('taskId') taskId: string, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.getEvidenceByTaskId(taskId, clientId, tenantId, role);
  }

  @Get('evidenceType/:evidenceType')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get all evidence for a evidencetype' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByType(
    @Param('evidenceType') evidenceType: EvidenceType,
    @Req() req: AuthenticatedRequest,
  ): Promise<EvidenceListResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.getEvidenceByType(evidenceType, clientId, tenantId, role);
  }

  @Get('case/:caseId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get all evidence for a case' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByCase(@Param('caseId') caseId: string, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.getEvidenceByCaseId(caseId, clientId, tenantId, role);
  }

  @Get(':id')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get evidence by ID' })
  @ApiResponse({
    status: 200,
    description: 'Evidence metadata retrieved successfully',
    type: EvidenceResponseDto,
  })
  async getEvidenceById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<EvidenceResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.getEvidenceById(id, clientId, tenantId, role);
  }

  @Get(':id/download')
  @RequireInvestigatorOrSupervisorRole()
  async downloadEvidence(@Param('id') id: string, @Res() res: Response,  @Query('attachmentName') attachmentName: string, @Req() req: AuthenticatedRequest) {
    const { clientId, tenantId, claims } = req.user.token;
    const role = claims.includes('cms_supervisor') ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    const { files, metadata } = await this.evidenceService.downloadEvidence(id, clientId, tenantId, role, attachmentName);

    if (!files.length) throw new NotFoundException('No files found');

    const file = files[0];
    const buffer = file.file;
    const fileName = file.attachmentMeta.fileName;
    const mimeType = file.attachmentMeta.mimeType;

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get(':id/verify')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Verify evidence integrity' })
  @ApiResponse({
    status: 200,
    description: 'Evidence integrity verified',
    type: VerifyEvidenceDto,
  })
  async verifyEvidence(
    @Param('id') id: string,
    @Param('attachmentName') attachmentName: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<VerifyEvidenceDto> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.verifyEvidence(id, clientId, tenantId, role, attachmentName);
  }
}