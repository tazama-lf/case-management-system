import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  Body,
  UseGuards,
  Res,
  Req,
  ParseFilePipe,
  MaxFileSizeValidator,
  UploadedFiles,
  NotFoundException,
  Delete,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { UploadEvidenceDto, EvidenceResponseDto, EvidenceListResponseDto, VerifyEvidenceDto, EvidenceType } from './dto';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole, TazamaClaims } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { Audit } from '../audit/decorators/audit-log.decorator';

@ApiTags('Evidence')
@Controller('api/v1/evidence')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
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
          enum: ['ADVERSE_MEDIA', 'SANCTIONS', 'OTHER', 'SAR_STR_FILING', 'KYC', 'EDD'],
          description: 'Type of evidence',
        },
        tags: {
          type: 'string',
          description: 'Tags (comma-separated)',
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
    const { clientId, tenantId } = req.user.token;
    return await this.evidenceService.uploadEvidence(files, dto, clientId, tenantId);
  }

  @Get('task/:taskId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get all evidence for a task' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByTask(@Param('taskId') taskId: number, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;

    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR)
      ? 'CMS_SUPERVISOR'
      : claims.includes(TazamaClaims.CMS_COMPLIANCE_OFFICER)
        ? 'CMS_COMPLIANCE_OFFICER'
        : 'CMS_INVESTIGATOR';
    return await this.evidenceService.getEvidenceByTaskId(taskId, clientId, tenantId, role);
  }

  @Get('evidenceType/:evidenceType')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return await this.evidenceService.getEvidenceByType(evidenceType, clientId, tenantId, role);
  }

  @Get('case/:caseId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get all evidence for a case' })
  @ApiResponse({
    status: 200,
    description: 'List of evidence retrieved successfully',
    type: EvidenceListResponseDto,
  })
  async getEvidenceByCase(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<EvidenceListResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR)
      ? 'CMS_SUPERVISOR'
      : claims.includes(TazamaClaims.CMS_COMPLIANCE_OFFICER)
        ? 'CMS_COMPLIANCE_OFFICER'
        : 'CMS_INVESTIGATOR';
    return await this.evidenceService.getEvidenceByCaseId(caseId, clientId, tenantId, role);
  }

  @Get(':id')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Get evidence by ID' })
  @ApiResponse({
    status: 200,
    description: 'Evidence metadata retrieved successfully',
    type: EvidenceResponseDto,
  })
  async getEvidenceById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<EvidenceResponseDto> {
    const { clientId, tenantId, claims } = req.user.token;
    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return await this.evidenceService.getEvidenceById(id, clientId, tenantId, role);
  }

  @Get(':id/download')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  async downloadEvidence(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('attachmentName') attachmentName: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const { clientId, tenantId, claims } = req.user.token;
    const role =
      claims.includes(TazamaClaims.CMS_SUPERVISOR) || claims.includes(TazamaClaims.CMS_COMPLIANCE_OFFICER)
        ? 'CMS_SUPERVISOR'
        : 'CMS_INVESTIGATOR';
    const { files } = await this.evidenceService.downloadEvidence(id, clientId, tenantId, role, attachmentName);

    if (!files.length) throw new NotFoundException('No files found');

    const file = files[0];
    const buffer = file.file;
    const { fileName } = file.attachmentMeta;
    const { mimeType } = file.attachmentMeta;

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Delete(':id/attachments/:attachmentName')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({ summary: 'delete evidence' })
  @ApiResponse({
    status: 200,
    description: 'Deleted evidence successfully',
  })
  async deleteEvidence(
    @Param('id') id: string,
    @Param('attachmentName') attachmentName: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EvidenceResponseDto> {
    const { clientId, tenantId } = req.user.token;
    return await this.evidenceService.deleteEvidence(id, attachmentName, clientId, tenantId);
  }

  @Get(':id/verify')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    const role = claims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';
    return await this.evidenceService.verifyEvidence(id, clientId, tenantId, role, attachmentName);
  }
}
