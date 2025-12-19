import { Controller, Post, Get, Body, Param, Req, UseGuards, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { TazamaDwhService } from './tazama-dwh.service';
import { GenerateProfileDto } from './dto/generate-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { CustomerProfileResponseDto } from './dto/customer-profile.dto';
import { RequireInvestigatorOrSupervisorRole } from 'src/decorators/auth.decorator';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';

@ApiTags('Tazama DWH')
@Controller('api/v1/dwh')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class TazamaDWHController {
  constructor(private readonly tazamaDwhService: TazamaDwhService) {}

  @Get('transactions/:creditorId')
  @RequireInvestigatorOrSupervisorRole()
  async getTransactionsByCreditor(
    @Req() req: AuthenticatedRequest,
    @Param('creditorId') creditorId: string,
  ) {
    const tenantId = req.user.token.tenantId;
    return this.tazamaDwhService.getTransactionsByCreditorId(tenantId, creditorId);
  }

  @Post('profile/generate')
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
  async generateProfile(@Body() dto: GenerateProfileDto, @Req() req: AuthenticatedRequest): Promise<ProfileResponseDto> {
    const userId = req.user?.token?.clientId ;
    return this.tazamaDwhService.generateProfile(dto, userId);
  }

  @Get('customer/profile/:id')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get customer profile with sender and receiver details for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID (e.g., TXN-001-01) to fetch both sender and receiver profiles' })
  @ApiResponse({ status: 200, description: 'Customer profiles retrieved for sender and receiver', type: CustomerProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getCustomerProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<CustomerProfileResponseDto> {
    // Query DWH to get transaction details and associated customer profiles
    return this.tazamaDwhService.getCustomerProfileByTransaction(id);
  }

}
