import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CaseInvestigatorBlacklist } from '@prisma/client-cms';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireSupervisorRole } from 'src/decorators/auth.decorator';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { extractUserData } from 'src/utils/helperFunction';
import { CaseInvestigatorService, CaseInvestigatorWithRole } from './case-investigator.service';
import { RevokeCaseInvestigatorDto, BlacklistCaseInvestigatorDto, UnblockCaseInvestigatorDto } from './dto';

// There is no POST /investigators (manual add) — the whitelist is
// populated exclusively by task assignment; nobody, including a
// supervisor, adds to it by hand. Every route here, including both GETs,
// requires CMS_SUPERVISOR — there's no "on-case investigator" peer tier
// left in this module to check for.

@ApiTags('CaseInvestigators')
@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class CaseInvestigatorController {
  constructor(private readonly caseInvestigatorService: CaseInvestigatorService) {}

  @Delete(':caseId/investigators/:userId')
  @RequireSupervisorRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke case-investigator access',
    description:
      'Soft-removes a live whitelist row. Mandatory reason. The user can be re-added later only via a fresh task assignment, not by hand.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing' })
  @ApiResponse({ status: 404, description: 'Not Found - no live whitelist entry for this user on this case' })
  async revokeInvestigator(
    @Param('caseId') caseId: number,
    @Param('userId') userId: string,
    @Body() dto: RevokeCaseInvestigatorDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const { userId: callerId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.revoke(caseId, userId, tenantId, callerId, dto.reason);
    return { message: 'Investigator access revoked' };
  }

  @Post(':caseId/blacklist')
  @RequireSupervisorRole()
  @Audit()
  @ApiOperation({
    summary: 'Blacklist a user from a case',
    description:
      'One transaction: revokes any live whitelist row (revoke_reason = "blacklisted"), then writes the blacklist row. Mandatory reason. Future task assignments for this user on this case refuse until a supervisor unblocks them.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 201, description: 'User blacklisted' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing or invalid userId' })
  async blacklistInvestigator(
    @Param('caseId') caseId: number,
    @Body() dto: BlacklistCaseInvestigatorDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const { userId: callerId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.blacklist(caseId, dto.userId, tenantId, callerId, dto.reason);
    return { message: 'Investigator blacklisted' };
  }

  @Delete(':caseId/blacklist/:userId')
  @RequireSupervisorRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unblock a user on a case',
    description:
      'Soft-update. Mandatory reason. Does NOT grant access back — a new task assignment is still required for this person to reappear on the whitelist.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User unblocked' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing' })
  @ApiResponse({ status: 404, description: 'Not Found - no live blacklist entry for this user on this case' })
  async unblockInvestigator(
    @Param('caseId') caseId: number,
    @Param('userId') userId: string,
    @Body() dto: UnblockCaseInvestigatorDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const { userId: callerId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.unblock(caseId, userId, tenantId, callerId, dto.reason);
    return { message: 'Investigator unblocked' };
  }

  @Get(':caseId/investigators')
  @RequireSupervisorRole()
  @ApiOperation({
    summary: 'List a case live whitelist',
    description:
      'Supervisor+ only. Each row carries user_role (null if unknown) so callers can tell which rows can be revoked/blacklisted (investigators only).',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Live whitelist rows' })
  async getInvestigators(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<CaseInvestigatorWithRole[]> {
    const { tenantId } = extractUserData(req);
    return await this.caseInvestigatorService.listWhitelist(caseId, tenantId);
  }

  @Get(':caseId/blacklist')
  @RequireSupervisorRole()
  @ApiOperation({ summary: 'List a case live blacklist', description: 'Supervisor+ only.' })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Live blacklist rows' })
  async getBlacklist(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<CaseInvestigatorBlacklist[]> {
    const { tenantId } = extractUserData(req);
    return await this.caseInvestigatorService.listBlacklist(caseId, tenantId);
  }
}
