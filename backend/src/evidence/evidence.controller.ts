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
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        evidenceType: {
          type: 'string',
          enum: ['ADVERSE_MEDIA', 'SANCTIONS', 'OTHER'],
          description: 'Type of evidence',
          example: 'SANCTIONS',
        },
        tags: {
          type: 'string',
          description: 'Tags (comma-separated)',
          example: 'kyc,screening',
        },
        description: {
          type: 'string',
          description: 'Description of evidence',
          example: 'OFAC sanctions screening results',
        },
        comments: {
          type: 'string',
          description: 'Additional comments',
          example: 'No matches found',
        },
        aggregator: {
          type: 'string',
          description: 'Media aggregator or tool (for ADVERSE_MEDIA)',
          example: 'LexisNexis',
        },
        dateSearched: {
          type: 'string',
          format: 'date',
          description: 'Date when media search was conducted (for ADVERSE_MEDIA)',
          example: '2025-11-17',
        },
        keywords: {
          type: 'string',
          description: 'Search keywords comma-separated (for ADVERSE_MEDIA)',
          example: 'fraud,money laundering',
        },
        findings: {
          type: 'string',
          description: 'Findings or summary (for ADVERSE_MEDIA)',
          example: 'No adverse media found',
        },
        screeningDate: {
          type: 'string',
          format: 'date',
          description: 'Date when screening was performed (for SANCTIONS)',
          example: '2025-11-17',
        },
        tool: {
          type: 'string',
          description: 'External screening tool or source used (for SANCTIONS)',
          example: 'WorldCheck',
        },
        summaryDisposition: {
          type: 'string',
          description: 'Summary of screening disposition (for SANCTIONS)',
          example: 'Cleared',
        },
        submissionDate: {
          type: 'string',
          format: 'date',
          description: 'Date when SAR/STR was submitted to FIU (for SAR_STR_FILING)',
          example: '2025-11-17',
        },
        referenceNumber: {
          type: 'string',
          description: 'Reference number from FIU acknowledgment (for SAR_STR_FILING)',
          example: 'SAR-2025-001234',
        },
        submissionChannel: {
          type: 'string',
          description: 'Submission channel (for SAR_STR_FILING)',
          example: 'Portal',
        },
      },
      required: ['files', 'taskId', 'evidenceType'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Evidence uploaded successfully (returns array even for single file)',
    type: [EvidenceResponseDto],
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
  @ApiOperation({ summary: 'Download evidence file' })
  @ApiResponse({
    status: 200,
    description: 'Evidence file downloaded successfully',
  })
  async downloadEvidence(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    const { file, metadata } = await this.evidenceService.downloadEvidence(id, clientId, tenantId, role);

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
    const { clientId, tenantId, claims } = req.user.token;
    if (!clientId || !tenantId || !claims) throw new BadRequestException('Missing clientId, tenantId or claims in auth token');

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return this.evidenceService.verifyEvidence(id, clientId, tenantId, role);
  }
}
