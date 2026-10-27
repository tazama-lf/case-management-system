import { BadRequestException, ConflictException, Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole, TazamaClaims } from 'src/decorators/auth.decorator';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { CaseInvestigatorService } from '../case-investigator/case-investigator.service';
import { CopilotService, ReviewRefused, type Caller } from './copilot.service';
import type { ReviewAction, ReviewRole } from './sar-review';

const ACTIONS: ReviewAction[] = ['SUBMIT', 'APPROVE', 'RETURN', 'WITHDRAW', 'FILE'];

/** Supervisors review (checker); investigators and compliance officers prepare and file (maker). */
function roleOf(req: AuthenticatedRequest): ReviewRole {
  return req.user.validClaims.includes(TazamaClaims.CMS_SUPERVISOR) ? 'checker' : 'maker';
}

function callerOf(req: AuthenticatedRequest): Caller {
  const { clientId, tenantId } = req.user.token;
  if (!tenantId) throw new BadRequestException('Missing tenantId');
  return { userId: clientId, tenantId, name: req.user.actorName ?? req.user.actorEmail ?? 'CMS user', email: req.user.actorEmail };
}

/**
 * Investigation copilot (backlog P4-2) and SAR/STR drafting agent (backlog P3-2).
 * Advisory only: nothing here changes a case, a task or its status.
 */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot')
@UseGuards(TazamaAuthGuard)
export class CopilotController {
  constructor(
    private readonly copilot: CopilotService,
    private readonly access: CaseInvestigatorService,
  ) {}

  /** The copilot reads the investigation material, so it follows the case ACL: no access, or revoked, means 404. */
  private async gate(caseId: number, req: AuthenticatedRequest): Promise<void> {
    await this.access.assertReadAccess(caseId, callerOf(req).userId, callerOf(req).tenantId, req.user.actorRole);
  }

  @Get('status')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Which model the copilot uses (bundled, bring-your-own-key or off), its licence, and whether it is reachable' })
  async status(): Promise<unknown> {
    return await this.copilot.status();
  }

  @Get('cases/:caseId/investigation')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'The latest stored investigation record for the case, or null' })
  async latest(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    await this.gate(caseId, req);
    return await this.copilot.latestInvestigation(caseId, callerOf(req).tenantId);
  }

  @Post('cases/:caseId/investigation')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({
    summary: 'Run the copilot: compute and embed the case facts, write the summary, red flags and next steps, and store the record',
  })
  async investigate(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    await this.gate(caseId, req);
    return await this.copilot.investigate(caseId, callerOf(req));
  }

  @Post('cases/:caseId/ask')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({ summary: 'Ask a question about the case; answered from the facts closest to it in the stored record' })
  async ask(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { question?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    await this.gate(caseId, req);
    const question = body.question?.trim();
    if (!question) throw new BadRequestException('question is required');
    return await this.copilot.ask(caseId, callerOf(req), question.slice(0, 500));
  }

  @Get('cases/:caseId/sar-draft')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'The latest SAR/STR draft for the case, or null' })
  async latestSar(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    await this.gate(caseId, req);
    return await this.copilot.latestSar(caseId, callerOf(req).tenantId);
  }

  @Post('cases/:caseId/sar-draft')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({
    summary: 'Draft the SAR/STR narrative and goAML XML from the stored investigation record (refresh: re-run the copilot first)',
  })
  async draftSar(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { refresh?: boolean },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    await this.gate(caseId, req);
    return await this.copilot.draftSar(caseId, callerOf(req), body.refresh === true);
  }

  @Get('cases/:caseId/sar-review')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({ summary: 'Where the latest SAR/STR draft stands in the review workflow, with its history' })
  async review(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    await this.gate(caseId, req);
    return { ...(await this.copilot.reviewState(caseId, callerOf(req).tenantId)), yourRole: roleOf(req) };
  }

  @Post('cases/:caseId/sar-review')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @Audit()
  @ApiOperation({ summary: 'Submit, approve, return, withdraw or file the latest SAR/STR draft (maker-checker)' })
  async reviewAction(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { action?: string; comment?: string; reference?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    await this.gate(caseId, req);
    const action = ACTIONS.find((a) => a === body.action);
    if (!action) throw new BadRequestException(`action must be one of ${ACTIONS.join(', ')}`);
    try {
      const role = roleOf(req);
      return {
        ...(await this.copilot.reviewAction(caseId, callerOf(req), role, action, body.comment ?? '', body.reference)),
        yourRole: role,
      };
    } catch (e) {
      if (e instanceof ReviewRefused) throw new ConflictException(e.message);
      throw e;
    }
  }
}
