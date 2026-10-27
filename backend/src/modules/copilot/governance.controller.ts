import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAnyClaims, RequireInvestigatorOrSupervisorRoleOrComplianceRole, TazamaClaims } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import type { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { CaseReadAccessGuard } from './case-read-access.guard';
import type { FeedbackRating } from './copilot.types';
import { FeedbackRefused, GovernanceService } from './governance.service';
import { callerOf } from './request-context';

const RATINGS: FeedbackRating[] = ['up', 'down'];
const PERIODS = [7, 30, 90, 365];

/** Ratings of copilot outputs (findings, chat answers, SAR drafts) by the people using them. Present when either feature is on. */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot/cases/:caseId')
@UseGuards(TazamaAuthGuard, CaseReadAccessGuard)
@RequireInvestigatorOrSupervisorRoleOrComplianceRole()
export class FeedbackController {
  constructor(private readonly governance: GovernanceService) {}

  @Post('feedback')
  @Audit()
  @ApiOperation({ summary: 'Rate a copilot output of this case (up or down, with an optional comment)' })
  async rate(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() body: { recordId?: number; rating?: string; comment?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    const rating = RATINGS.find((r) => r === body.rating);
    if (!rating || !Number.isInteger(body.recordId)) throw new BadRequestException('recordId and a rating of up or down are required');
    try {
      return await this.governance.rate(
        caseId,
        callerOf(req),
        body.recordId!,
        rating,
        typeof body.comment === 'string' ? body.comment : '',
      );
    } catch (e) {
      if (e instanceof FeedbackRefused) throw new NotFoundException(e.message);
      throw e;
    }
  }
}

/** What the copilot did in a period, for supervisors and compliance officers. Present when either feature is on. */
@ApiTags('Copilot')
@ApiBearerAuth('jwt')
@Controller('api/v1/copilot/governance')
@UseGuards(TazamaAuthGuard)
@RequireAnyClaims(TazamaClaims.CMS_SUPERVISOR, TazamaClaims.CMS_COMPLIANCE_OFFICER)
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get()
  @Audit()
  @ApiOperation({
    summary: 'Governance report: models and prompt versions used, checks, agent fallbacks, ratings, reviews and the record chain',
  })
  async report(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number, @Req() req: AuthenticatedRequest): Promise<unknown> {
    if (!PERIODS.includes(days)) throw new BadRequestException(`days must be one of ${PERIODS.join(', ')}`);
    return await this.governance.report(callerOf(req).tenantId, days);
  }
}
