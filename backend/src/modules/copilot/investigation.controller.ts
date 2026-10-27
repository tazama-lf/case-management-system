import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { CaseReadAccessGuard } from './case-read-access.guard';
import { InvestigationService } from './investigation.service';
import { callerOf } from './request-context';

const MAX_QUESTION = 500;

/**
 * Investigation copilot (backlog P4-2). Advisory only: nothing here changes a case, a task or its status.
 * Registered only when COPILOT_INVESTIGATION_ENABLED=true.
 */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot/cases/:caseId')
@UseGuards(TazamaAuthGuard, CaseReadAccessGuard)
@RequireInvestigatorOrSupervisorRoleOrComplianceRole()
export class InvestigationController {
  constructor(private readonly investigation: InvestigationService) {}

  @Get('investigation')
  @ApiOperation({ summary: 'The latest stored investigation record for the case, or null' })
  async latest(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return await this.investigation.latest(caseId, callerOf(req).tenantId);
  }

  @Post('investigation')
  @Audit()
  @ApiOperation({
    summary: 'Run the copilot: compute and embed the case facts, write the summary, red flags and next steps, and store the record',
  })
  async investigate(@Param('caseId', ParseIntPipe) caseId: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return await this.investigation.investigate(caseId, callerOf(req));
  }

  @Post('ask')
  @Audit()
  @ApiOperation({ summary: 'Ask a question about the case; answered only from the case facts' })
  async ask(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { question?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    const question = body.question?.trim();
    if (!question) throw new BadRequestException('question is required');
    return await this.investigation.ask(caseId, callerOf(req), question.slice(0, MAX_QUESTION));
  }
}
