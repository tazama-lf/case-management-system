import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireInvestigatorOrSupervisorRole } from '../auth/auth.decorator';

@ApiTags('Transaction Profile')
@Controller('api/v1/profile')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('generate')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Generate transaction profile for a case (DWH data)' })
  @ApiBody({
    type: GenerateProfileDto,
    examples: {
      default: {
        summary: 'Typical profile generation',
        value: {
          caseId: '123e4567-e89b-12d3-a456-426614174000',
          filters: {
            dateFrom: '2025-09-01',
            dateTo: '2025-11-30',
            channel: 'Online',
            type: 'Transfer',
            geography: 'Cross-border',
            tenantId: 'T001',
          },
          notes: 'Profile generated for peer comparison and anomaly detection.',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Profile generated', type: ProfileResponseDto })
  async generateProfile(@Body() dto: GenerateProfileDto, @Req() req): Promise<ProfileResponseDto> {
    const userId = req.user?.token?.clientId || 'mock-user';
    return this.profileService.generateProfile(dto, userId);
  }

  @Get(':caseId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get transaction profile for a case' })
  @ApiResponse({ status: 200, description: 'Profile retrieved', type: ProfileResponseDto })
  async getProfile(@Param('caseId') caseId: string): Promise<ProfileResponseDto> {
    return this.profileService.getProfile(caseId);
  }
}
