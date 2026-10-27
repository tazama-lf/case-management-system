import { BadRequestException, Body, ConflictException, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { CaseReadAccessGuard } from './case-read-access.guard';
import { callerOf, roleOf } from './request-context';
import type { ReviewAction } from './sar-review';
import { ReviewRefused, SarService } from './sar.service';

const ACTIONS: ReviewAction[] = ['SUBMIT', 'APPROVE', 'RETURN', 'WITHDRAW', 'FILE'];

/**
 * SAR/STR drafting agent (backlog P3-2) and the maker-checker review of its draft.
 * Registered only when COPILOT_SAR_ENABLED=true.
 */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot/cases/:caseId')
@UseGuards(TazamaAuthGuard, CaseReadAccessGuard)
@RequireInvestigatorOrSupervisorRoleOrComplianceRole()
export class SarController {
  constructor(private readonly sar: SarService) {}

  @Get('sar-draft')
  @ApiOperation({ summary: 'The latest SAR/STR draft for the case, or null' })
  async latest(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return await this.sar.latest(caseId, callerOf(req).tenantId);
  }

  @Post('sar-draft')
  @Audit()
  @ApiOperation({
    summary: 'Draft the SAR/STR narrative and goAML XML from the stored investigation record (refresh: re-run the copilot first)',
  })
  async draft(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { refresh?: boolean },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return await this.sar.draft(caseId, callerOf(req), body.refresh === true);
  }

  @Get('sar-review')
  @ApiOperation({ summary: 'Where the latest SAR/STR draft stands in the review workflow, with its history' })
  async review(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return { ...(await this.sar.reviewState(caseId, callerOf(req).tenantId)), yourRole: roleOf(req) };
  }

  @Post('sar-review')
  @Audit()
  @ApiOperation({ summary: 'Submit, approve, return, withdraw or file the latest SAR/STR draft (maker-checker)' })
  async reviewAction(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { action?: string; comment?: string; reference?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    const action = ACTIONS.find((a) => a === body.action);
    if (!action) throw new BadRequestException(`action must be one of ${ACTIONS.join(', ')}`);
    const role = roleOf(req);
    try {
      return { ...(await this.sar.review(caseId, callerOf(req), role, action, body.comment ?? '', body.reference)), yourRole: role };
    } catch (e) {
      if (e instanceof ReviewRefused) throw new ConflictException(e.message);
      throw e;
    }
  }
}
