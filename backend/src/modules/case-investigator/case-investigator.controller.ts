import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CaseInvestigatorBlocklist } from '@prisma/client-cms';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole, RequireSupervisorRole } from 'src/decorators/auth.decorator';
import { Audit } from '../audit/decorators/audit-log.decorator';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { extractUserData } from 'src/utils/helperFunction';
import { CaseInvestigatorService, CaseInvestigatorWithRole } from './case-investigator.service';
import { RevokeCaseInvestigatorDto, BlocklistCaseInvestigatorDto, UnblockCaseInvestigatorDto } from './dto';

// There is no POST /investigators (manual add) — the allowlist is
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
      'Soft-removes a live allowlist row. Mandatory reason. The user can be re-added later only via a fresh task assignment, not by hand.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing' })
  @ApiResponse({ status: 404, description: 'Not Found - no live allowlist entry for this user on this case' })
  async revokeInvestigator(
    @Param('caseId') caseId: number,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: RevokeCaseInvestigatorDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const { userId: callerId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.revoke(caseId, userId, tenantId, callerId, dto.reason);
    return { message: 'Investigator access revoked' };
  }

  @Post(':caseId/blocklist')
  @RequireSupervisorRole()
  @Audit()
  @ApiOperation({
    summary: 'Blocklist a user from a case',
    description:
      'One transaction: revokes any live allowlist row (revoke_reason = "blocklisted"), then writes the blocklist row. Mandatory reason. Future task assignments for this user on this case refuse until a supervisor unblocks them.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 201, description: 'User blocklisted' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing or invalid userId' })
  async blocklistInvestigator(
    @Param('caseId') caseId: number,
    @Body() dto: BlocklistCaseInvestigatorDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const { userId: callerId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.blocklist(caseId, dto.userId, tenantId, callerId, dto.reason);
    return { message: 'Investigator blocklisted' };
  }

  @Delete(':caseId/blocklist/:userId')
  @RequireSupervisorRole()
  @Audit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unblock a user on a case',
    description:
      'Soft-update. Mandatory reason. Does NOT grant access back — a new task assignment is still required for this person to reappear on the allowlist.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User unblocked' })
  @ApiResponse({ status: 400, description: 'Bad Request - reason missing' })
  @ApiResponse({ status: 404, description: 'Not Found - no live blocklist entry for this user on this case' })
  async unblockInvestigator(
    @Param('caseId') caseId: number,
    @Param('userId', new ParseUUIDPipe()) userId: string,
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
    summary: 'List a case live allowlist',
    description:
      'Supervisor+ only. Each row carries user_role (null if unknown) so callers can tell which rows can be revoked/blocklisted (investigators only).',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Live allowlist rows' })
  async getInvestigators(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<CaseInvestigatorWithRole[]> {
    const { tenantId } = extractUserData(req);
    return await this.caseInvestigatorService.listAllowlist(caseId, tenantId);
  }

  @Get(':caseId/investigators/history')
  @RequireSupervisorRole()
  @ApiOperation({
    summary: 'List who lost access to a case, and who was unblocked',
    description:
      'Supervisor+ only. Revoked allowlist rows (manual and automatic) and unblocked blocklist rows for this case, most recent first. Rows are soft-updated, never deleted, so this is the full record.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Revoked allowlist rows and unblocked blocklist rows' })
  async getAccessHistory(
    @Param('caseId') caseId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ revoked: CaseInvestigatorWithRole[]; unblocked: CaseInvestigatorBlocklist[] }> {
    const { tenantId } = extractUserData(req);
    return await this.caseInvestigatorService.listAccessHistory(caseId, tenantId);
  }

  @Get(':caseId/blocked-users')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'List the ids of users blocked on a case',
    description:
      'Anyone who may view the case (investigator or supervisor). Ids only - no reasons or blockers - so the assign/reassign dropdowns can leave blocked people out. The backend refuses to assign a blocked user regardless.',
  })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Ids of users with a live block on this case' })
  async getBlockedUsers(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<{ userIds: string[] }> {
    const { userId, tenantId } = extractUserData(req);
    await this.caseInvestigatorService.assertViewAccess(caseId, userId, tenantId, req.user.actorRole);
    return { userIds: await this.caseInvestigatorService.listBlockedUserIds(caseId, tenantId) };
  }

  @Get(':caseId/blocklist')
  @RequireSupervisorRole()
  @ApiOperation({ summary: 'List a case live blocklist', description: 'Supervisor+ only.' })
  @ApiParam({ name: 'caseId', type: 'number', example: 123 })
  @ApiResponse({ status: 200, description: 'Live blocklist rows' })
  async getBlocklist(@Param('caseId') caseId: number, @Req() req: AuthenticatedRequest): Promise<CaseInvestigatorBlocklist[]> {
    const { tenantId } = extractUserData(req);
    return await this.caseInvestigatorService.listBlocklist(caseId, tenantId);
  }
}
